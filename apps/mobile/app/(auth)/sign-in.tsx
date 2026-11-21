import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Input } from '../../src/components/Input';
import { useSession } from '../../src/lib/session';
import { supabase } from '../../src/lib/supabase';

type Step = 'email' | 'code';

export default function SignIn() {
  const { session } = useSession();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Redirect href="/" />;

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (err) setError('Could not send the code. Check the email address and try again.');
    else setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (err) setError('That code is invalid or expired.');
    // On success onAuthStateChange updates the session and the redirect above runs.
  };

  const canSend = /\S+@\S+\.\S+/.test(email) && !busy;
  const canVerify = code.trim().length >= 6 && !busy;

  return (
    <View className="flex-1 justify-center gap-4 bg-surface px-gutter">
      <Text className="text-3xl font-bold text-brand">Wayfinder</Text>
      {step === 'email' ? (
        <>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Pressable
            disabled={!canSend}
            onPress={() => void sendCode()}
            className={`items-center rounded-card py-3 ${canSend ? 'bg-brand' : 'bg-line'}`}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Email me a code</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text className="text-ink-muted">Enter the 6-digit code sent to {email}.</Text>
          <Input
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={10}
          />
          <Pressable
            disabled={!canVerify}
            onPress={() => void verify()}
            className={`items-center rounded-card py-3 ${canVerify ? 'bg-brand' : 'bg-line'}`}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="font-semibold text-white">Sign in</Text>}
          </Pressable>
          <Pressable onPress={() => { setStep('email'); setCode(''); setError(null); }}>
            <Text className="text-center text-brand">Use a different email</Text>
          </Pressable>
        </>
      )}
      {error ? <Text className="text-danger">{error}</Text> : null}
    </View>
  );
}
