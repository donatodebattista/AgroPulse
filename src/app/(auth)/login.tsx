import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (loginEmail?: string, loginPassword?: string) => {
    const targetEmail = loginEmail ?? email.trim();
    const targetPassword = loginPassword ?? password;

    if (!targetEmail || !targetPassword) {
      setErrorMessage('Por favor, ingresa tu correo y contraseña');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: targetPassword,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('Credenciales inválidas. Verifica tu correo y contraseña.');
        } else {
          setErrorMessage(error.message);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocurrió un error inesperado al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const fillQuickTest = (testEmail: string) => {
    setEmail(testEmail);
    setPassword('AgroPulse2026!');
    setErrorMessage(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header de Marca */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>🌱</Text>
            </View>
            <Text style={styles.brandTitle}>AgroPulse</Text>
            <Text style={styles.brandSubtitle}>Monitoreo y Riego de Precisión</Text>
          </View>

          {/* Formulario */}
          <View style={styles.formContainer}>
            <Text style={styles.formTitle}>Iniciar Sesión</Text>

            {errorMessage ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="ejemplo@agropulse.test"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contraseña</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.buttonDisabled]}
              onPress={() => handleLogin()}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginButtonText}>Ingresar</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Acceso Rápido para Pruebas Académicas */}
          <View style={styles.quickAccessSection}>
            <Text style={styles.quickAccessTitle}>Usuarios de Prueba (Semilla Concordia)</Text>
            <View style={styles.quickAccessButtons}>
              <TouchableOpacity
                style={styles.quickBadge}
                onPress={() => fillQuickTest('producer@agropulse.test')}
              >
                <Text style={styles.quickBadgeRole}>Productor</Text>
                <Text style={styles.quickBadgeDesc}>Edita umbrales y riega</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickBadge}
                onPress={() => fillQuickTest('operator@agropulse.test')}
              >
                <Text style={styles.quickBadgeRole}>Operador</Text>
                <Text style={styles.quickBadgeDesc}>Riega válvulas</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickBadge}
                onPress={() => fillQuickTest('advisor@agropulse.test')}
              >
                <Text style={styles.quickBadgeRole}>Asesor</Text>
                <Text style={styles.quickBadgeDesc}>Solo lectura</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoBadgeText: {
    fontSize: 32,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 4,
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 24,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loginButton: {
    backgroundColor: '#166534',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  quickAccessSection: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
  },
  quickAccessTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  quickAccessButtons: {
    gap: 8,
  },
  quickBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickBadgeRole: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  quickBadgeDesc: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
