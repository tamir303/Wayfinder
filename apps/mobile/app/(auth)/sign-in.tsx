import { Redirect } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Input } from '../../src/components/Input';
import { useSession } from '../../src/lib/session';
import { auth } from '../../src/lib/auth';

type Step = 'email' | 'code';

export default function SignIn() {
  const { t } = useTranslation();
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
    if (err) setError(t('auth.sendFailed'));
    else setStep('code');
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const err = await auth.verifyCode(email.trim(), code.trim()).then(() => null, (e: unknown) => e);
    setBusy(false);
    if (err) setError(t('auth.codeInvalid'));
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
            label={t('auth.emailLabel')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder={t('auth.emailPlaceholder')}
          />
          <Button label={t('auth.sendCode')} disabled={!canSend} busy={busy} onPress={() => void sendCode()} />
        </>
      ) : (
        <>
          <Text className="text-ink-muted">{t('auth.enterCode', { email })}</Text>
          <Input
            label={t('auth.codeLabel')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            maxLength={10}
          />
          <Button label={t('auth.signIn')} disabled={!canVerify} busy={busy} onPress={() => void verify()} />
          <Pressable accessibilityRole="button" accessibilityLabel={t('auth.differentEmail')} onPress={() => { setStep('email'); setCode(''); setError(null); }}>
            <Text className="text-center text-brand">{t('auth.differentEmail')}</Text>
          </Pressable>
        </>
      )}
      {error ? <Text className="text-danger">{error}</Text> : null}
    </View>
  );
}
