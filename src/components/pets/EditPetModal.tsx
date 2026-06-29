import React, { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
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
  TextAreaInput,
  TextInput,
} from '../ui/FormUI';

interface EditPetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pet: any;
}

export default function EditPetModal({ isOpen, onClose, onSuccess, pet }: EditPetModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    breed: '',
    age: '',
    gender: '',
    size: '',
    weight:'',
    status: '',
    description: '',
    healthStatus: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    if (!pet) return;

    setFormData({
      name: pet.name || '',
      type: pet.type || 'Dog',
      breed: pet.breed || '',
      age: pet.age?.toString() || '',
      gender: pet.gender || 'Male',
      size: pet.size || 'Medium',
      weight: pet.weight?.toString() || '',
      status: pet.status || 'Available',
      description: pet.description || '',
      healthStatus: pet.healthStatus || 'See description for medical notes',
    });
  }, [pet]);

  if (!isOpen || !pet) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => data.append(key, value));
      if (imageFile) {
        data.append('image', imageFile);
      }

      await api.put(`/pets/${pet._id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addToast('success', `${formData.name || pet.name} was updated successfully.`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to update pet', error);
      addToast('error', 'Failed to update pet details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell maxWidth="max-w-2xl">
      <ModalHeader
        title={`Edit ${pet.name}'s Profile`}
        subtitle="Keep listing details accurate so adopters and staff see the same trusted information."
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody>
          {pet.imageUrl && !imageFile ? (
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <img
                src={pet.imageUrl}
                alt={pet.name}
                className="h-20 w-20 rounded-lg border border-slate-200 object-cover shadow-sm"
              />
              <div>
                <p className="text-sm font-bold text-slate-700">Current Photo</p>
                <p className="text-xs text-slate-500">Upload a new image below to replace it.</p>
              </div>
            </div>
          ) : null}

          <FormSection title="Profile Photo">
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:bg-slate-100">
              <Upload className="mx-auto mb-3 text-emerald-500" size={32} />
              <p className="text-sm font-semibold text-slate-700">
                {imageFile ? imageFile.name : 'Select a new image'}
              </p>
              <p className="mt-1 text-xs text-slate-500">Leave this empty to keep the current photo.</p>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="mt-4 w-full max-w-xs cursor-pointer text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-200"
              />
            </div>
          </FormSection>

          <FormSection title="Basic Details">
            <FieldGrid>
              <FormField label="Name" required>
                <TextInput
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </FormField>

              <FormField label="Type" required>
                <SelectInput
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="Dog">Dog</option>
                  <option value="Cat">Cat</option>
                  <option value="Other">Other</option>
                </SelectInput>
              </FormField>

              <FormField label="Breed" required>
                <TextInput
                  required
                  type="text"
                  value={formData.breed}
                  onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                />
              </FormField>

              <FormField label="Age (Years)" required hint="Keep this numeric for easier sorting and filtering.">
                <TextInput
                  required
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                />
              </FormField>

              <FormField label="Weight (kg)" hint="e.g., 25.5">
                <TextInput
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Enter weight in kilograms"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                />
              </FormField>

              <FormField label="Gender">
                <SelectInput
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </SelectInput>
              </FormField>

              <FormField label="Size">
                <SelectInput
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                >
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                  <option value="Large">Large</option>
                </SelectInput>
              </FormField>
            </FieldGrid>
          </FormSection>

          <FormSection
            title="Adoption Readiness"
            description="This status is prominently shown elsewhere, so changes here should reflect the current shelter reality."
          >
            <FormField label="Status">
              <SelectInput
                value={formData.status}
                className="border-emerald-200 bg-emerald-50 font-medium text-emerald-800"
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="Available">Available for Adoption</option>
                <option value="Pending">Adoption Pending</option>
                <option value="Adopted">Adopted</option>
              </SelectInput>
            </FormField>

            <FormField label="Health Status">
            <TextInput
            type="text"
            placeholder="e.g., Healthy, Needs medication, Post-surgery recovery"
            value={formData.healthStatus}
            onChange={(e) => setFormData({ ...formData, healthStatus: e.target.value })}
            />
            </FormField>

            <FormField label="Description & Medical Notes">
              <TextAreaInput
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
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
