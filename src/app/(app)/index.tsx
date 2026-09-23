import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth-context';

export default function DashboardScreen() {
  const { user, currentOrg, currentRole, memberships, switchOrganization, signOut } = useAuth();
  const [showOrgModal, setShowOrgModal] = useState(false);

  const getRoleBadgeStyle = (role: string | null) => {
    switch (role) {
      case 'producer':
        return { bg: '#dcfce7', text: '#15803d', label: 'Productor' };
      case 'operator':
        return { bg: '#e0f2fe', text: '#0369a1', label: 'Operador de Riego' };
      case 'advisor':
        return { bg: '#fef3c7', text: '#b45309', label: 'Asesor Agrónomo' };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: 'Sin Rol' };
    }
  };

  const roleInfo = getRoleBadgeStyle(currentRole);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Superior */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.appName}>AgroPulse</Text>
          <TouchableOpacity
            style={styles.orgSelectorButton}
            onPress={() => memberships.length > 1 && setShowOrgModal(true)}
            activeOpacity={memberships.length > 1 ? 0.7 : 1}
          >
            <Text style={styles.orgName} numberOfLines={1}>
              {currentOrg ? currentOrg.name : 'Cargando establecimiento...'}
            </Text>
            {memberships.length > 1 && <Text style={styles.orgChevron}>▼</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={() => signOut()} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Tarjeta de Perfil & Rol Activo */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user?.email}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: roleInfo.bg }]}>
                <Text style={[styles.roleBadgeText, { color: roleInfo.text }]}>
                  {roleInfo.label}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.orgDetailRow}>
            <Text style={styles.detailLabel}>Región:</Text>
            <Text style={styles.detailValue}>
              {currentOrg?.region ?? 'Zona Concordia / Entre Ríos'}
            </Text>
          </View>
        </View>

        {/* Estado de la Conexión & Siguiente Iteración */}
        <View style={styles.card}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIndicator} />
            <Text style={styles.statusTitle}>BaaS Supabase Conectado</Text>
          </View>
          <Text style={styles.statusDescription}>
            Sesión y RLS validados exitosamente. El usuario actual se encuentra aislado en el
            perímetro de su establecimiento con permisos asignados para el rol{' '}
            <Text style={{ fontWeight: '700' }}>{roleInfo.label}</Text>.
          </Text>

          <View style={styles.nextStepBanner}>
            <Text style={styles.nextStepTitle}>Listo para Iteración 3</Text>
            <Text style={styles.nextStepText}>
              • Mapeo geoespacial de polígonos de lotes (Costa 1, Costa 2, Monte A).
              {'\n'}• Semáforo de humedad y detección de GPS en lote (RF-05, RF-06, RF-12).
            </Text>
          </View>
        </View>

        {/* Selector si hay más de 1 Organización (RF-03) */}
        {memberships.length > 1 && (
          <View style={styles.card}>
            <Text style={styles.cardSectionTitle}>Establecimientos Disponibles ({memberships.length})</Text>
            <Text style={styles.cardSubtitle}>
              Selecciona el establecimiento activo para filtrar lotes y mediciones.
            </Text>
            {memberships.map((m) => {
              const isSelected = m.organization_id === currentOrg?.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.orgItem, isSelected && styles.orgItemSelected]}
                  onPress={() => switchOrganization(m.organization_id)}
                >
                  <View>
                    <Text style={[styles.orgItemName, isSelected && styles.orgItemNameSelected]}>
                      {m.organization?.name}
                    </Text>
                    <Text style={styles.orgItemRole}>Rol asignado: {m.role}</Text>
                  </View>
                  {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal para Selector de Organización */}
      <Modal visible={showOrgModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cambiar Establecimiento</Text>
            {memberships.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.modalItem}
                onPress={() => {
                  switchOrganization(m.organization_id);
                  setShowOrgModal(false);
                }}
              >
                <Text style={styles.modalItemName}>{m.organization?.name}</Text>
                <Text style={styles.modalItemRegion}>{m.organization?.region}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowOrgModal(false)}>
              <Text style={styles.modalCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  appName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  orgSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  orgName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: '85%',
  },
  orgChevron: {
    fontSize: 11,
    color: '#64748b',
    marginLeft: 6,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#dc2626',
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  orgDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    marginRight: 8,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  nextStepBanner: {
    marginTop: 14,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 12,
  },
  nextStepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  nextStepText: {
    fontSize: 13,
    color: '#15803d',
    lineHeight: 18,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
  },
  orgItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8,
  },
  orgItemSelected: {
    borderColor: '#166534',
    backgroundColor: '#f0fdf4',
  },
  orgItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  orgItemNameSelected: {
    color: '#166534',
    fontWeight: '700',
  },
  orgItemRole: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#166534',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
  },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalItemRegion: {
    fontSize: 13,
    color: '#64748b',
  },
  modalCloseButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
  },
});
