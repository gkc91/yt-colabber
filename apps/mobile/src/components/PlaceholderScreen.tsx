import { Screen } from '@/components/Screen';
import { Body } from '@/components/Type';

export function PlaceholderScreen({ message }: { message: string }) {
  return (
    <Screen center>
      <Body tone="muted">{message}</Body>
    </Screen>
  );
}
