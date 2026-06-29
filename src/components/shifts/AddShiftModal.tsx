import { Calendar as CalendarIcon, Clock, Users } from 'lucide-react';
import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import {
  FieldGrid,
  FormActions,
  FormField,
  FormSection,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalShell,
  TextInput,
} from '../ui/FormUI';

interface AddShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddShiftModal({ isOpen, onClose, onSuccess }: AddShiftModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    durationHours: '',
    capacity: '',
  });
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/appointments', {
        ...formData,
        durationHours: Number(formData.durationHours),
        capacity: Number(formData.capacity),
      });
      addToast('success', 'Shift created successfully.');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to create shift', error);
      addToast('error', 'Failed to create shift. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell maxWidth="max-w-xl">
      <ModalHeader
        title="Create Volunteer Shift"
        subtitle="Define the shift details so volunteers know when and how they can help."
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
        <ModalBody>
          <FormSection title="Shift Details">
            <FormField label="Shift Title" required hint="Use a short, recognizable activity name.">
              <TextInput
                required
                type="text"
                placeholder="e.g., Morning Dog Walking"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </FormField>

            <FormField label="Date & Time" required>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <TextInput
                  required
                  type="datetime-local"
                  className="pl-10"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </FormField>

            <FieldGrid>
              <FormField label="Duration (Hours)" required>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <TextInput
                    required
                    type="number"
                    min="1"
                    className="pl-10"
                    placeholder="e.g., 2"
                    value={formData.durationHours}
                    onChange={(e) => setFormData({ ...formData, durationHours: e.target.value })}
                  />
                </div>
              </FormField>

              <FormField label="Capacity" required hint="Maximum number of volunteers for this shift.">
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <TextInput
                    required
                    type="number"
                    min="1"
                    className="pl-10"
                    placeholder="Max volunteers"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  />
                </div>
              </FormField>
            </FieldGrid>
          </FormSection>
        </ModalBody>

        <ModalFooter>
          <FormActions onCancel={onClose} submitLabel="Create Shift" loadingLabel="Creating..." loading={loading} />
        </ModalFooter>
      </form>
    </ModalShell>
  );
}
