import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowLeft, Send, Search, User as UserIcon } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StateDisplays';

const SOCKET_URL = api.defaults.baseURL?.replace('/api', '') || 'http://localhost:5000';

// FIX: Made the check case-insensitive to ensure it catches "Admin", "admin", "Shelter", etc.
const isShelterMessage = (sender?: string) => {
  const senderStr = String(sender || '').toLowerCase();
  return senderStr === 'shelter' || senderStr === 'admin';
};

const formatMessageTime = (message: any) =>
  message.time ||
  (message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '');

export default function Chat() {
  const location = useLocation();
  const { addToast } = useToast();

  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedUserRef = useRef(selectedUser);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      setSessionsError(null);
      const response = await api.get('/chat-sessions');
      setSessions(response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setSessionsError('Unable to load chat sessions right now. Please try again.');
      return [];
    } finally {
      setSessionsLoading(false);
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      setMessagesLoading(true);
      setMessagesError(null);
      const response = await api.get(`/messages/${userId}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessagesError('Unable to load this conversation right now. Please try again.');
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    const initChat = async () => {
      const data = await fetchSessions();

      if (location.state && location.state.selectedUserId && data) {
        const targetUser = data.find((user: any) => user._id === location.state.selectedUserId);
        if (targetUser) {
          setSelectedUser(targetUser);
          fetchMessages(targetUser._id);
          window.history.replaceState({}, document.title);
        }
      }
    };

    initChat();

    socketRef.current = io(SOCKET_URL, {
      auth: {
        token: localStorage.getItem('adminToken'),
      },
    });

    socketRef.current.on('connect', () => {
      socketRef.current?.emit('joinAdmin');
    });

    socketRef.current.on('receiveMessage', (newMessage) => {
      fetchSessions();

      // Compare as strings — newMessage.userId is ObjectId from MongoDB
      const incomingUserId = newMessage.userId?.toString() ?? newMessage.userId;
      const selectedId = selectedUserRef.current?._id?.toString() ?? selectedUserRef.current?._id;

      if (selectedUserRef.current && incomingUserId === selectedId) {
        setMessages((prev) => {
          // Deduplicate: skip if message with same _id already exists
          if (newMessage._id && prev.some((m) => m._id === newMessage._id)) return prev;
          return [...prev, newMessage];
        });
      }
    });

    socketRef.current.on('connect_error', () => {
      addToast('warning', 'Live chat connection is unstable. Retrying automatically.');
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const handleUserSelect = (user: any) => {
    setSelectedUser(user);
    fetchMessages(user._id);
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedUser || !socketRef.current) return;

    // FIX: Added sender property so the database knows who sent it
    const messageData = {
      userId: selectedUser._id,
      text: inputText.trim(),
      sender: 'admin' 
    };

    try {
      setIsSending(true);
      setInputText('');
      socketRef.current.emit('sendMessage', messageData);
      setTimeout(fetchSessions, 300);
    } catch (error) {
      console.error('Failed to send message:', error);
      addToast('error', 'Failed to send your message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredSessions = sessions.filter((user) =>
    (user.displayName || 'Unknown User').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100dvh-70px)] lg:h-[calc(100vh-4rem)] bg-white lg:rounded-2xl lg:shadow-sm border-t lg:border border-slate-200 overflow-hidden lg:m-8">
      <div className={`${selectedUser ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 border-r border-slate-200 bg-slate-50 flex-col`}>
        <div className="p-4 border-b border-slate-200 bg-white flex-shrink-0">
          <h2 className="text-xl font-extrabold text-slate-800 mb-4">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {sessionsError ? (
            <div className="p-4">
              <ErrorState title="Chat Unavailable" message={sessionsError} onRetry={fetchSessions} />
            </div>
          ) : sessionsLoading ? (
            <div className="p-4">
              <LoadingState message="Loading conversations..." />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={searchTerm ? 'No users found' : 'No conversations yet'}
                message={
                  searchTerm
                    ? 'Try searching with a different name.'
                    : 'When users send messages from the app, they will appear here.'
                }
              />
            </div>
          ) : (
            filteredSessions.map((user) => (
              <button
                key={user._id}
                onClick={() => handleUserSelect(user)}
                className={`w-full text-left p-4 border-b border-slate-100 flex items-center gap-3 transition-colors ${
                  selectedUser?._id === user._id
                    ? 'bg-emerald-50/50 relative before:absolute before:left-0 before:top-0 before:h-full before:w-1 before:bg-emerald-500'
                    : 'hover:bg-slate-100'
                }`}
              >
                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold overflow-hidden shrink-0">
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt={user.displayName} className="w-full h-full object-cover" />
                  ) : (
                    user.displayName ? user.displayName.charAt(0).toUpperCase() : <UserIcon size={20} />
                  )}
                </div>
                <div className="flex-1 overflow-hidden">
                  <h3 className={`font-bold truncate text-sm ${selectedUser?._id === user._id ? 'text-emerald-800' : 'text-slate-800'}`}>
                    {user.displayName || 'Unknown User'}
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">Open conversation</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className={`${!selectedUser ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-white w-full relative`}>
        {selectedUser ? (
          <>
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center gap-3 bg-white shrink-0 shadow-sm z-10">
              <button
                onClick={() => setSelectedUser(null)}
                className="md:hidden p-2 mr-1 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold overflow-hidden shrink-0">
                {selectedUser.profilePicture ? (
                  <img src={selectedUser.profilePicture} alt={selectedUser.displayName} className="w-full h-full object-cover" />
                ) : (
                  selectedUser.displayName ? selectedUser.displayName.charAt(0).toUpperCase() : <UserIcon size={18} />
                )}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 leading-tight">{selectedUser.displayName || 'Unknown User'}</h3>
                <p className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 mt-0.5 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
                  Active conversation
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 custom-scrollbar">
              <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full">
                {messagesError ? (
                  <ErrorState title="Conversation Unavailable" message={messagesError} onRetry={() => fetchMessages(selectedUser._id)} />
                ) : messagesLoading ? (
                  <LoadingState message="Loading conversation..." />
                ) : messages.length === 0 ? (
                  <EmptyState
                    title="No messages yet"
                    message="Send a message to start helping this user."
                  />
                ) : (
                  messages.map((msg, index) => {
                    const isShelter = isShelterMessage(msg.sender);
                    return (
                      <div
                        key={msg._id || index}
                        className={`flex items-end gap-2 w-full ${isShelter ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        {!isShelter && (
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs overflow-hidden shrink-0 mb-5">
                            {selectedUser.profilePicture ? (
                              <img src={selectedUser.profilePicture} alt={selectedUser.displayName} className="w-full h-full object-cover" />
                            ) : (
                              selectedUser.displayName ? selectedUser.displayName.charAt(0).toUpperCase() : <UserIcon size={12} />
                            )}
                          </div>
                        )}

                        <div className={`flex flex-col max-w-[75%] ${isShelter ? 'items-end' : 'items-start'}`}>
                          <div
                            className={`px-4 py-2.5 text-sm font-medium ${
                              isShelter
                                ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm shadow-md shadow-emerald-600/10'
                                : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-tl-sm shadow-sm'
                            }`}
                          >
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 px-1">{formatMessageTime(msg)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-white border-t border-slate-200 shrink-0">
              <div className="flex items-center gap-3 max-w-3xl mx-auto w-full">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type your message..."
                  className="flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-sm font-medium transition-all shadow-inner"
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputText.trim() || isSending}
                  className="w-12 h-12 shrink-0 bg-emerald-600 text-white rounded-full flex items-center justify-center hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-md"
                >
                  <Send size={18} className="ml-1" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
            <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <UserIcon size={40} className="text-slate-400" />
            </div>
            <p className="text-lg font-bold text-slate-600">Select a conversation</p>
            <p className="text-sm mt-1 text-slate-500">Choose a user from the sidebar to start chatting.</p>
          </div>
        )}
      </div>
    </div>
  );
}