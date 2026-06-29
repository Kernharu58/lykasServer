import React, { useState } from 'react';
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

interface AddPetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPetModal({ isOpen, onClose, onSuccess }: AddPetModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'Dog',
    breed: '',
    age: '',
    gender: 'Male',
    size: 'Medium',
    weight:'',
    status: 'Available',
    description: '',
    healthStatus: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => data.append(key, value));
      if (imageFile) {
        data.append('image', imageFile);
      }

      await api.post('/pets', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      addToast('success', 'Pet added successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to add pet', error);
      addToast('error', 'Failed to add pet. Please check the form and your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell maxWidth="max-w-2xl">
      <ModalHeader
        title="Add New Pet"
        subtitle="Create a complete listing so staff can manage intake and adoption visibility in one place."
        onClose={onClose}
      />

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody>
          <FormSection title="Profile Photo" description="A clear photo helps adopters identify the pet quickly.">
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:bg-slate-100">
              <Upload className="mx-auto mb-3 text-emerald-500" size={32} />
              <p className="text-sm font-semibold text-slate-700">
                {imageFile ? imageFile.name : 'Upload a pet photo'}
              </p>
              <p className="mt-1 text-xs text-slate-500">PNG, JPG, or JPEG up to 5MB</p>
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

              <FormField label="Age (Years)" required hint="Use decimals if needed, like 1.5 for one and a half years.">
                <TextInput
                  required
                  type="number"
                  step="0.1"
                  min="0"
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

          <FormSection title="Adoption Readiness">
            <FormField label="Status">
              <SelectInput
                value={formData.status}
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

            <FormField
              label="Description & Medical Notes"
              hint="Include temperament, vaccinations, restrictions, and any care instructions staff should know."
            >
              <TextAreaInput
                rows={5}
                placeholder="Enter pet personality, medical history, vaccinations, and care notes..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </FormField>
          </FormSection>
        </ModalBody>

        <ModalFooter>
          <FormActions onCancel={onClose} submitLabel="Add Pet" loadingLabel="Saving..." loading={loading} />
        </ModalFooter>
      </form>
    </ModalShell>
  );
}
