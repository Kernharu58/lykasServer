import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  Clock,
  Eye,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  PlusCircle,
  Trash2,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';
import api from '../services/api';
import AddShiftModal from '../components/shifts/AddShiftModal';
import EditShiftModal from '../components/shifts/EditShiftModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StateDisplays';
import { Card, PageHeader, SectionHeader, StatCard } from '../components/ui/SharedUI';
import { useToast } from '../context/ToastContext';

export default function Shifts() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [shiftToEdit, setShiftToEdit] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string; title: string }>({
    isOpen: false,
    id: '',
    title: '',
  });

  const navigate = useNavigate();
  const { addToast } = useToast();

  const fetchShifts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await api.get('/appointments');
      setShifts(response.data);

      if (selectedShift) {
        const updatedShift = response.data.find((shift: any) => shift._id === selectedShift._id);
        if (updatedShift) {
          setSelectedShift(updatedShift);
        }
      }
    } catch (fetchError) {
      console.error('Error fetching shifts:', fetchError);
      setError('Unable to load volunteer shifts right now. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, []);

  const executeDelete = async () => {
    try {
      await api.delete(`/appointments/${confirmDelete.id}`);
      addToast('success', `Shift "${confirmDelete.title}" was deleted.`);
      fetchShifts();
    } catch (deleteError) {
      console.error('Error deleting shift:', deleteError);
      addToast('error', 'Failed to delete shift. Please try again.');
    } finally {
      setConfirmDelete({ isOpen: false, id: '', title: '' });
    }
  };

  const totalVolunteers = shifts.reduce((acc, shift) => acc + (shift.enrolledUsers?.length || 0), 0);
  const openShifts = shifts.filter((shift) => shift.status === 'Open').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full relative">
      <PageHeader
        title="Shifts & Volunteers"
        description="Create schedules, review enrollment, and coordinate volunteer coverage."
        action={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <PlusCircle size={20} />
            Create Shift
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard icon={<Calendar size={28} />} label="Total Shifts" value={shifts.length} tone="emerald" />
        <StatCard icon={<Clock size={28} />} label="Open Shifts" value={openShifts} tone="blue" />
        <StatCard icon={<Users size={28} />} label="Volunteers Enrolled" value={totalVolunteers} tone="purple" />
      </div>

      <Card noPadding>
        <div className="p-5 border-b border-slate-100 bg-slate-50/60">
          <SectionHeader
            title="Scheduled Shifts"
            description="Review upcoming schedules, edit availability, and inspect volunteer sign-ups."
          />
        </div>

        <div className="p-5 sm:p-6">
          {error ? (
            <ErrorState message={error} onRetry={fetchShifts} />
          ) : isLoading ? (
            <LoadingState message="Loading volunteer schedules..." />
          ) : shifts.length === 0 ? (
            <EmptyState
              title="No shifts scheduled"
              message="Create the first volunteer shift to start organizing shelter support."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-white border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="p-4 font-bold">Shift Title</th>
                    <th className="p-4 font-bold">Date & Time</th>
                    <th className="p-4 font-bold">Duration</th>
                    <th className="p-4 font-bold">Volunteers</th>
                    <th className="p-4 font-bold">Status</th>
                    <th className="p-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift._id} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 font-semibold text-slate-800">{shift.title}</td>
                      <td className="p-4 text-slate-600 text-sm font-medium">{new Date(shift.date).toLocaleString()}</td>
                      <td className="p-4 text-slate-600 text-sm">{shift.durationHours} hours</td>
                      <td className="p-4 text-slate-600 text-sm font-medium">
                        {shift.enrolledUsers?.length || 0} / {shift.capacity}
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            shift.status === 'Open'
                              ? 'bg-emerald-100 text-emerald-700'
                              : shift.status === 'Full'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {shift.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => setSelectedShift(shift)}
                            className="flex items-center gap-2 text-sm text-emerald-700 font-medium hover:bg-emerald-100 bg-emerald-50 px-4 py-2 rounded-xl transition-colors"
                          >
                            <Eye size={16} /> View
                          </button>
                          <button
                            onClick={() => {
                              setShiftToEdit(shift);
                              setIsEditModalOpen(true);
                            }}
                            className="flex items-center justify-center p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit shift"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ isOpen: true, id: shift._id, title: shift.title })}
                            className="flex items-center justify-center p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete shift"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {selectedShift && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-white">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Enrolled Volunteers</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  {selectedShift.title} • {new Date(selectedShift.date).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => setSelectedShift(null)} className="text-slate-400 hover:text-slate-700 bg-slate-50 rounded-full p-2">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
              {(!selectedShift.enrolledUsers || selectedShift.enrolledUsers.length === 0) ? (
                <EmptyState title="No volunteers yet" message="This shift is still open, but nobody has signed up so far." />
              ) : (
                <div className="space-y-4">
                  {selectedShift.enrolledUsers.map((enrollment: any, idx: number) => {
                    const volunteer = enrollment.user || {};
                    return (
                      <div key={idx} className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row gap-6">
                        <div className="md:w-1/3 flex flex-col items-center text-center md:items-start md:text-left border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 pr-0 md:pr-4">
                          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold overflow-hidden border border-emerald-200 mb-3">
                            {volunteer.profilePicture ? (
                              <img src={volunteer.profilePicture} alt={volunteer.displayName} className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={24} />
                            )}
                          </div>
                          <h4 className="font-bold text-slate-800 text-lg">{volunteer.displayName || 'Unknown User'}</h4>
                          <p className="text-sm text-slate-500 mt-1 flex items-center justify-center md:justify-start gap-1">
                            <Mail size={14} /> {volunteer.email || 'No email'}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            Applied: {new Date(enrollment.appliedAt).toLocaleDateString()}
                          </p>

                          <button
                            onClick={() => navigate('/chat', { state: { selectedUserId: volunteer._id } })}
                            className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-emerald-50 text-emerald-700 font-medium rounded-xl hover:bg-emerald-100 transition-colors"
                          >
                            <MessageSquare size={16} />
                            Message
                          </button>
                        </div>

                        <div className="flex-1 flex flex-col justify-center">
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <Phone size={18} className="text-emerald-600 mt-0.5" />
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone Number</p>
                                <p className="font-medium text-slate-800">{enrollment.phone || 'Not provided'}</p>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <AlertCircle size={18} className="text-amber-500 mt-0.5" />
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Emergency Contact</p>
                                <p className="font-medium text-slate-800">{enrollment.emergencyContact || 'Not provided'}</p>
                              </div>
                            </div>
                          </div>

                          {enrollment.notes && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Additional Notes</p>
                              <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 italic">
                                "{enrollment.notes}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <AddShiftModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={fetchShifts} />

      <EditShiftModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchShifts}
        shift={shiftToEdit}
      />

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete Shift"
        message={`Are you sure you want to delete "${confirmDelete.title}"? This will cancel it for all enrolled volunteers.`}
        confirmText="Delete Shift"
        isDestructive
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: '', title: '' })}
      />
    </div>
  );
}
