import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/context/auth-context';

export function AppHeader() {
  const { currentOrg, currentRole, memberships, switchOrganization } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const getRoleStyle = (role: string | null) => {
    switch (role) {
      case 'producer':
        return { bg: '#dcfce7', text: '#15803d', label: 'Productor' };
      case 'operator':
        return { bg: '#e0f2fe', text: '#0369a1', label: 'Operador' };
      case 'advisor':
        return { bg: '#fef3c7', text: '#b45309', label: 'Asesor' };
      default:
        return { bg: '#f1f5f9', text: '#475569', label: 'Sin Rol' };
    }
  };

  const role = getRoleStyle(currentRole);

  return (
    <View style={styles.headerContainer}>
      <View style={styles.leftCol}>
        <Text style={styles.brandTitle}>AgroPulse</Text>
        <TouchableOpacity
          style={styles.orgSelector}
          onPress={() => memberships.length > 1 && setShowModal(true)}
          activeOpacity={memberships.length > 1 ? 0.7 : 1}
        >
          <Text style={styles.orgName} numberOfLines={1}>
            {currentOrg?.name ?? 'Establecimiento'}
          </Text>
          {memberships.length > 1 && <Text style={styles.chevron}>▼</Text>}
        </TouchableOpacity>
      </View>

      <View style={[styles.roleBadge, { backgroundColor: role.bg }]}>
        <Text style={[styles.roleText, { color: role.text }]}>{role.label}</Text>
      </View>

      {/* Modal para selección de establecimiento (RF-03) */}
      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalHeading}>Cambiar Establecimiento</Text>
            {memberships.map((m) => {
              const active = m.organization_id === currentOrg?.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modalRow, active && styles.modalRowActive]}
                  onPress={() => {
                    switchOrganization(m.organization_id);
                    setShowModal(false);
                  }}
                >
                  <View>
                    <Text style={[styles.modalOrgTitle, active && styles.activeText]}>
                      {m.organization?.name}
                    </Text>
                    <Text style={styles.modalOrgSubtitle}>{m.organization?.region}</Text>
                  </View>
                  {active && <Text style={styles.check}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowModal(false)}>
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  leftCol: {
    flex: 1,
    marginRight: 10,
  },
  brandTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  orgSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: '85%',
  },
  chevron: {
    fontSize: 10,
    color: '#64748b',
    marginLeft: 6,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 14,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalRowActive: {
    backgroundColor: '#f0fdf4',
  },
  modalOrgTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  activeText: {
    color: '#166534',
    fontWeight: '700',
  },
  modalOrgSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  check: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
  },
  closeBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
});
