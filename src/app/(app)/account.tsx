import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/common/app-header';
import { useAuth } from '@/context/auth-context';
import { useLocation } from '@/hooks/use-location';

export default function AccountScreen() {
  const { user, currentOrg, currentRole, memberships, switchOrganization, signOut } = useAuth();
  const { userLocation, locationError, currentPlot } = useLocation();
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Tarjeta de Usuario */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={styles.profileCol}>
              <Text style={styles.userName}>{user?.email?.split('@')[0] ?? 'Usuario'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Rol en el Establecimiento:</Text>
            <Text style={styles.infoValue}>
              {currentRole === 'producer'
                ? '🌱 Productor (Acceso Total)'
                : currentRole === 'operator'
                ? '🚜 Operador de Riego'
                : '📋 Asesor Agrónomo (Solo Lectura)'}
            </Text>
          </View>
        </View>

        {/* Establecimientos Asociados */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tus Establecimientos ({memberships.length})</Text>
          <Text style={styles.cardSubtitle}>
            Aislamiento de datos gobernado por Row Level Security (RLS).
          </Text>

          {memberships.map((m) => {
            const isSelected = m.organization_id === currentOrg?.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.orgCard, isSelected && styles.orgCardSelected]}
                onPress={() => switchOrganization(m.organization_id)}
                activeOpacity={0.7}
              >
                <View>
                  <Text style={[styles.orgCardName, isSelected && styles.orgCardNameSelected]}>
                    {m.organization?.name}
                  </Text>
                  <Text style={styles.orgCardRegion}>{m.organization?.region}</Text>
                </View>
                {isSelected ? (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>Activo</Text>
                  </View>
                ) : (
                  <Text style={styles.selectText}>Seleccionar</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Observabilidad y Diagnóstico Académico (RF-23) */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.diagHeader}
            onPress={() => setShowDiagnostics(!showDiagnostics)}
          >
            <Text style={styles.diagTitle}>⚙️ Diagnóstico del Sistema (RF-23)</Text>
            <Text style={styles.diagToggle}>{showDiagnostics ? 'Ocultar ▲' : 'Mostrar ▼'}</Text>
          </TouchableOpacity>

          {showDiagnostics && (
            <View style={styles.diagBody}>
              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>User ID (Auth):</Text>
                <Text style={styles.diagCode}>{user?.id}</Text>
              </View>

              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>Organization ID (Activa):</Text>
                <Text style={styles.diagCode}>{currentOrg?.id}</Text>
              </View>

              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>GPS Dispositivo:</Text>
                <Text style={styles.diagCode}>
                  {userLocation
                    ? `${userLocation.latitude.toFixed(4)}, ${userLocation.longitude.toFixed(4)}`
                    : locationError || 'Buscando...'}
                </Text>
              </View>

              <View style={styles.diagItem}>
                <Text style={styles.diagLabel}>Lote Actual (RF-06):</Text>
                <Text style={styles.diagCode}>
                  {currentPlot ? `${currentPlot.name} (${currentPlot.id})` : 'Ninguno / Fuera de lote'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Botón Cerrar Sesión (RF-01) */}
        <TouchableOpacity style={styles.logoutBtn} onPress={() => signOut()} activeOpacity={0.8}>
          <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#166534',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  profileCol: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
  },
  orgCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  orgCardSelected: {
    borderColor: '#166534',
    backgroundColor: '#f0fdf4',
  },
  orgCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  orgCardNameSelected: {
    color: '#166534',
    fontWeight: '700',
  },
  orgCardRegion: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  activePill: {
    backgroundColor: '#166534',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  selectText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  diagHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  diagToggle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  diagBody: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  diagItem: {
    gap: 2,
  },
  diagLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  diagCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#0f172a',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  logoutBtnText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '700',
  },
});
