import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Users } from 'lucide-react';
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
  SelectInput,
  TextInput,
} from '../ui/FormUI';

interface EditShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  shift: any;
}

export default function EditShiftModal({ isOpen, onClose, onSuccess, shift }: EditShiftModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    durationHours: '',
    capacity: '',
    status: 'Open',
  });
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (!shift) return;

    const dateObj = new Date(shift.date);
    const localDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
    const formattedDate = localDate.toISOString().slice(0, 16);

    setFormData({
      title: shift.title || '',
      date: formattedDate,
      durationHours: shift.durationHours?.toString() || '',
      capacity: shift.capacity?.toString() || '',
      status: shift.status || 'Open',
    });
  }, [shift]);

  if (!isOpen || !shift) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.put(`/appointments/${shift._id}`, {
        ...formData,
        durationHours: Number(formData.durationHours),
        capacity: Number(formData.capacity),
      });
      addToast('success', 'Shift updated successfully.');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating shift:', error);
      addToast('error', 'Failed to update shift.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell maxWidth="max-w-xl">
      <ModalHeader
        title="Edit Volunteer Shift"
        subtitle="Update timing, capacity, or availability before volunteers arrive."
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody>
          <FormSection title="Shift Details">
            <FormField label="Shift Title" required>
              <TextInput
                required
                type="text"
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
                    min="0.5"
                    step="0.5"
                    className="pl-10"
                    value={formData.durationHours}
                    onChange={(e) => setFormData({ ...formData, durationHours: e.target.value })}
                  />
                </div>
              </FormField>

              <FormField label="Max Volunteers" required>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <TextInput
                    required
                    type="number"
                    min="1"
                    className="pl-10"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  />
                </div>
              </FormField>
            </FieldGrid>

            <FormField
              label="Status"
              hint="Keep volunteers informed by updating the shift once it fills or finishes."
            >
              <SelectInput
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Open">Open</option>
                <option value="Full">Full</option>
                <option value="Completed">Completed</option>
              </SelectInput>
            </FormField>
          </FormSection>
        </ModalBody>

        <ModalFooter>
          <FormActions
            onCancel={onClose}
            submitLabel="Save Changes"
            loadingLabel="Saving..."
            loading={loading}
          />
        </ModalFooter>
      </form>
    </ModalShell>
  );
}
