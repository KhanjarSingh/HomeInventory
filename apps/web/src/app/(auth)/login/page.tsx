'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ProfileUnlock } from '../../../components/auth/ProfileUnlock';

export default function LoginPage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 sm:p-6">
      <ProfileUnlock onSuccess={handleSuccess} />
    </div>
  );
}
