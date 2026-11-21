import { Pressable, Text, View } from 'react-native';
import { supabase } from '../../src/lib/supabase';

export default function Home() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-surface">
      <Text className="text-xl text-ink">Signed in</Text>
      <Pressable onPress={() => void supabase.auth.signOut()}>
        <Text className="text-brand">Sign out</Text>
      </Pressable>
    </View>
  );
}
