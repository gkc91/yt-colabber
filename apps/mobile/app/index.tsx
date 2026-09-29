import { Redirect } from 'expo-router';

import { useSession } from '@/features/auth/session';
import { useProfile } from '@/features/profile/api';

export default function Index() {
  const { session } = useSession();
  const profile = useProfile(session?.user.id);

  // Giriş yapmamış kişi önce uygulamanın ne yaptığını görür, sonra girer (2026-09-29).
  // Doğrudan /sign-in'e düşürmek, karşılığında ne alacağını bilmeyen birinden kimlik
  // istemek demekti.
  if (!session) return <Redirect href="/welcome" />;
  if (profile.data?.onboarding_done) return <Redirect href="/review" />;
  return <Redirect href="/niche" />;
}
