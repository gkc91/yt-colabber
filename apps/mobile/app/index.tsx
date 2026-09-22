import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/session';
import { useProfile } from '@/features/profile/api';

export default function Index() {
  const { session } = useSession();
  const profile = useProfile(session?.user.id);

  if (!session) return <Redirect href="/sign-in" />;
  if (profile.data?.onboarding_done) return <Redirect href="/review" />;
  return <Redirect href="/niche" />;
}
