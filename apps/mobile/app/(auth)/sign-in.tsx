import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useSession } from '../../src/lib/session';
import { auth } from '../../src/lib/auth';

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
    const err = await auth.sendCode(email.trim()).then(() => null, (e: unknown) => e);
    setBusy(false);
    if (err) setError('Could not send the code. Check the email address and try again.');
    else setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const err = await auth.verifyCode(email.trim(), code.trim()).then(() => null, (e: unknown) => e);
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
          <Button label="Email me a code" disabled={!canSend} busy={busy} onPress={() => void sendCode()} />
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
          <Button label="Sign in" disabled={!canVerify} busy={busy} onPress={() => void verify()} />
          <Pressable accessibilityRole="button" accessibilityLabel="Use a different email" onPress={() => { setStep('email'); setCode(''); setError(null); }}>
            <Text className="text-center text-brand">Use a different email</Text>
          </Pressable>
        </>
      )}
      {error ? <Text className="text-danger">{error}</Text> : null}
    </View>
  );
}
