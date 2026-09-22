import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export function PlaceholderScreen({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
});
