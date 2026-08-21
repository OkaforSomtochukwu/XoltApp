import { Badge, Button, Card, Input, Screen } from '@xolt/ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  getMyDoctorProfile,
  getMyLatestVerification,
  getMyVerificationDocuments,
  saveMyDoctorProfile,
  startVerification,
  uploadVerificationDocument,
  type DoctorDocumentRow,
  type DoctorDocumentType,
  type DoctorVerificationRow,
} from '@/lib/doctor-onboarding';

const VERIFICATION_LABEL: Record<string, string> = {
  pending: 'Pending',
  under_review: 'Under review',
  verified: 'Verified',
  rejected: 'Rejected',
};

const DOCUMENT_TYPES: { value: DoctorDocumentType; label: string }[] = [
  { value: 'medical_license', label: 'Medical license' },
  { value: 'id_card', label: 'ID card' },
  { value: 'specialty_certificate', label: 'Specialty certificate' },
  { value: 'other', label: 'Other' },
];

function ProfileForm() {
  const [loading, setLoading] = useState(true);
  const [specialty, setSpecialty] = useState('');
  const [yearsOfExperience, setYearsOfExperience] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [bio, setBio] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getMyDoctorProfile()
      .then((profile) => {
        if (!profile) return;
        setSpecialty(profile.specialty ?? '');
        setYearsOfExperience(profile.years_of_experience?.toString() ?? '');
        setConsultationFee(profile.consultation_fee?.toString() ?? '');
        setBio(profile.bio ?? '');
        setLicenseNumber(profile.license_number ?? '');
        setClinicName(profile.clinic_name ?? '');
        setClinicAddress(profile.clinic_address ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await saveMyDoctorProfile({
        specialty,
        yearsOfExperience: yearsOfExperience ? Number(yearsOfExperience) : null,
        consultationFee: consultationFee ? Number(consultationFee) : null,
        bio,
        licenseNumber,
        clinicName,
        clinicAddress,
      });
      setMessage('Saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <ActivityIndicator />
      </Card>
    );
  }

  return (
    <Card>
      <Card.Kicker>Profile</Card.Kicker>
      <Card.Title>Practice details</Card.Title>
      <Card.Body>
        Patients see your specialty and fee when searching for a doctor — this only matters once
        you're verified and online.
      </Card.Body>
      <Input label="Specialty" value={specialty} onChangeText={setSpecialty} />
      <Input
        label="Years of experience"
        value={yearsOfExperience}
        onChangeText={setYearsOfExperience}
        keyboardType="number-pad"
      />
      <Input
        label="Consultation fee (₦)"
        value={consultationFee}
        onChangeText={setConsultationFee}
        keyboardType="decimal-pad"
      />
      <Input label="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={3} />
      <Input label="License number" value={licenseNumber} onChangeText={setLicenseNumber} />
      <Input label="Clinic name" value={clinicName} onChangeText={setClinicName} />
      <Input label="Clinic address" value={clinicAddress} onChangeText={setClinicAddress} />
      <Button variant="primary" onPress={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save profile'}
      </Button>
      {message && <Card.Body>{message}</Card.Body>}
    </Card>
  );
}

function VerificationSection() {
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<DoctorVerificationRow | null>(null);
  const [documents, setDocuments] = useState<DoctorDocumentRow[]>([]);
  const [starting, setStarting] = useState(false);
  const [uploadingType, setUploadingType] = useState<DoctorDocumentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const latest = await getMyLatestVerification();
    setVerification(latest);
    if (latest) {
      setDocuments(await getMyVerificationDocuments(latest.id));
    } else {
      setDocuments([]);
    }
  }

  useEffect(() => {
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      await startVerification();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start verification.');
    } finally {
      setStarting(false);
    }
  }

  async function handleUpload(documentType: DoctorDocumentType) {
    if (!verification) return;
    setUploadingType(documentType);
    setError(null);
    try {
      // Lazy import, not a static top-level one — Expo Router's web dev
      // server evaluates every route file's imports during SSR route-tree
      // validation, and expo-document-picker's native entry point (not its
      // .web.js one, for reasons that only show up in that SSR pass)
      // crashes the whole app with "requireNativeComponent is not a
      // function" if imported statically. A dynamic import only runs this
      // client-side, when the button is actually pressed.
      const DocumentPicker = await import('expo-document-picker');
      const result = await DocumentPicker.getDocumentAsync({ multiple: false });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      await uploadVerificationDocument(verification.id, documentType, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that document.');
    } finally {
      setUploadingType(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <ActivityIndicator />
      </Card>
    );
  }

  const canSubmitNew = !verification || verification.status === 'rejected';
  const canUpload = verification && (verification.status === 'pending' || verification.status === 'under_review');

  return (
    <Card>
      <Card.Kicker>Verification</Card.Kicker>
      <Card.Title>Get verified to go online</Card.Title>

      {verification ? (
        <Badge variant={verification.status === 'verified' ? 'accent' : 'neutral'}>
          {VERIFICATION_LABEL[verification.status]}
        </Badge>
      ) : (
        <Badge variant="outline">Not submitted</Badge>
      )}

      {verification?.status === 'rejected' && verification.rejection_reason && (
        <Card.Body>{`Reason: ${verification.rejection_reason}`}</Card.Body>
      )}

      {canSubmitNew && (
        <Button variant="primary" onPress={handleStart} disabled={starting}>
          {starting ? 'Starting…' : verification ? 'Resubmit for verification' : 'Start verification'}
        </Button>
      )}

      {canUpload && (
        <View style={styles.stack}>
          <Card.Body>Upload at least one document — a medical license is the minimum admins expect.</Card.Body>
          <View style={styles.docTypeRow}>
            {DOCUMENT_TYPES.map((docType) => (
              <Button
                key={docType.value}
                variant="secondary"
                onPress={() => handleUpload(docType.value)}
                disabled={uploadingType !== null}
              >
                {uploadingType === docType.value ? 'Uploading…' : docType.label}
              </Button>
            ))}
          </View>
        </View>
      )}

      {documents.length > 0 && (
        <View style={styles.stack}>
          <Card.Kicker>Submitted documents</Card.Kicker>
          {documents.map((doc) => (
            <Card.Meta key={doc.id}>{`${doc.document_type} — ${doc.file_name ?? doc.file_path}`}</Card.Meta>
          ))}
        </View>
      )}

      {error && <Card.Body>{error}</Card.Body>}
    </Card>
  );
}

export default function ProfileScreen() {
  return (
    <Screen scroll>
      <View style={styles.stack}>
        <ProfileForm />
        <VerificationSection />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  docTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
