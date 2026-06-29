import { useEffect, useState } from 'react';
import { Edit, Plus, Search, Trash2 } from 'lucide-react';
import api from '../services/api';
import AddPetModal from '../components/pets/AddPetModal';
import EditPetModal from '../components/pets/EditPetModal';
import ConfirmModal from '../components/ui/ConfirmModal';
import { useToast } from '../context/ToastContext';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/StateDisplays';
import { Card, PageHeader, Toolbar } from '../components/ui/SharedUI';

interface Pet {
  _id: string;
  name: string;
  breed: string;
  status: string;
  imageUrl: string;
}

export default function ManagePets() {
  const [searchQuery, setSearchQuery] = useState('');
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: '',
    name: '',
  });

  const { addToast } = useToast();

  const fetchPets = async () => {
    setLoading(true);
    try {
      setError(null);
      const response = await api.get('/pets?all=true');
      setPets(response.data);
    } catch (fetchError) {
      console.error('Failed to fetch pets:', fetchError);
      setError('Unable to load pet records right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPets();
  }, []);

  const filteredPets = pets.filter((pet) =>
    pet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pet.breed.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const executeDelete = async () => {
    try {
      await api.delete(`/pets/${confirmDelete.id}`);
      addToast('success', `${confirmDelete.name} was removed from the shelter.`);
      fetchPets();
    } catch (deleteError) {
      console.error('Failed to delete pet:', deleteError);
      addToast('error', 'Could not delete the pet. Please try again.');
    } finally {
      setConfirmDelete({ isOpen: false, id: '', name: '' });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <PageHeader
        title="Manage Pets"
        description="Add, update, and review shelter animals in one place."
        action={
          <button
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold inline-flex items-center justify-center hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus size={20} className="mr-2" />
            Add New Pet
          </button>
        }
      />

      <Card noPadding className="mb-8">
        <Toolbar>
          <div>
            <h2 className="font-bold text-slate-800">Shelter Directory</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Search across all pet profiles, including adopted and pending records.
            </p>
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name or breed..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </Toolbar>

        <div className="p-5 sm:p-6">
          {error ? (
            <ErrorState message={error} onRetry={fetchPets} />
          ) : loading ? (
            <LoadingState message="Loading pets from the shelter database..." />
          ) : filteredPets.length === 0 ? (
            <EmptyState
              title={searchQuery ? 'No matching pets found' : 'No pets available'}
              message={
                searchQuery
                  ? 'Try a different name or breed, or clear the search to view all animals.'
                  : 'Add your first pet profile to start managing shelter listings.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPets.map((pet) => (
                <div key={pet._id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 flex flex-col">
                  <div className="h-48 overflow-hidden relative bg-slate-100">
                    <img src={pet.imageUrl} alt={pet.name} className="w-full h-full object-cover" />
                    <div
                      className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border shadow-sm ${
                        pet.status === 'Available'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          : pet.status === 'Pending'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {pet.status}
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{pet.name}</h3>
                      <p className="text-slate-500 text-sm mt-1 font-medium">{pet.breed}</p>
                    </div>

                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSelectedPet(pet);
                          setIsEditModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit pet"
                      >
                        <Edit size={18} />
                      </button>

                      <button
                        onClick={() => setConfirmDelete({ isOpen: true, id: pet._id, name: pet.name })}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete pet"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <AddPetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchPets} />

      <EditPetModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={fetchPets}
        pet={selectedPet}
      />

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete Pet"
        message={`Are you sure you want to remove ${confirmDelete.name} from the shelter? This action cannot be undone.`}
        confirmText="Delete Pet"
        isDestructive
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, id: '', name: '' })}
      />
    </div>
  );
}
