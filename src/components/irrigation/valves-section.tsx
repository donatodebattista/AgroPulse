import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ValveWithCommand, CommandFeedback } from '@/hooks/use-plot-valves';
import { CommandFeedbackBanner } from './command-feedback-banner';

interface ValvesSectionProps {
  valves: ValveWithCommand[];
  isLoading: boolean;
  isAdvisor: boolean;
  feedback: CommandFeedback | null;
  onDismissFeedback: () => void;
  onOpenCommandModal: (valve: ValveWithCommand) => void;
  onResolvePending?: (commandId: string) => Promise<void>;
}

export function ValvesSection({
  valves,
  isLoading,
  isAdvisor,
  feedback,
  onDismissFeedback,
  onOpenCommandModal,
  onResolvePending,
}: ValvesSectionProps) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  return (
    <View style={styles.container}>
      {/* Encabezado de la Sección */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.titleIcon}>🚰</Text>
          <Text style={styles.sectionTitle}>Válvulas y Control de Riego</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{valves.length}</Text>
        </View>
      </View>

      <Text style={styles.sectionDescription}>
        Supervisa el estado en tiempo real (RF-13) y emite órdenes de apertura o cierre con garantía de idempotencia (RF-14).
      </Text>

      {/* Banner de Feedback en Tiempo Real (RF-15, RNF-05) */}
      <CommandFeedbackBanner feedback={feedback} onDismiss={onDismissFeedback} />

      {/* Estado de Carga */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#166534" />
          <Text style={styles.loadingText}>Cargando estado de válvulas...</Text>
        </View>
      ) : valves.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💧</Text>
          <Text style={styles.emptyTitle}>Sin válvulas configuradas</Text>
          <Text style={styles.emptySubtitle}>
            Este lote aún no tiene actuadores ni válvulas de riego asociadas.
          </Text>
        </View>
      ) : (
        <View style={styles.valvesList}>
          {valves.map((valve) => {
            const hasPending = !!valve.pendingCommand;
            const isOpen = valve.status === 'open';

            return (
              <View key={valve.id} style={styles.valveCard}>
                {/* Cabecera de la Válvula */}
                <View style={styles.cardTopRow}>
                  <View style={styles.valveInfoCol}>
                    <Text style={styles.valveName}>{valve.name}</Text>
                    <Text style={styles.valveMeta}>
                      ID: {valve.id.slice(0, 8)}...
                    </Text>
                  </View>

                  {/* Badge de Estado / Pending (RF-13, RF-16) */}
                  <View
                    style={[
                      styles.statusPill,
                      hasPending
                        ? styles.pillPending
                        : isOpen
                        ? styles.pillOpen
                        : styles.pillClosed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        hasPending
                          ? styles.textPending
                          : isOpen
                          ? styles.textOpen
                          : styles.textClosed,
                      ]}
                    >
                      {hasPending ? '⏳ En proceso' : isOpen ? '💧 Abierta' : '🔒 Cerrada'}
                    </Text>
                  </View>
                </View>

                {/* Nota informativa si hay comando en curso */}
                {hasPending && (
                  <View style={styles.pendingNotice}>
                    <Text style={styles.pendingNoticeText}>
                      ⚠️ Orden "{valve.pendingCommand?.action === 'open' ? 'Apertura' : 'Cierre'}" pendiente en el actuador. Válvula bloqueada (RF-16).
                    </Text>

                    {!isAdvisor && onResolvePending && (
                      <TouchableOpacity
                        style={styles.resolveBtn}
                        onPress={async () => {
                          const cmdId = valve.pendingCommand!.id;
                          try {
                            setResolvingId(cmdId);
                            await onResolvePending(cmdId);
                          } catch (e: any) {
                            Alert.alert('Simulador de Actuador', e.message || 'Error al resolver comando');
                          } finally {
                            setResolvingId(null);
                          }
                        }}
                        disabled={resolvingId === valve.pendingCommand!.id}
                        activeOpacity={0.8}
                      >
                        {resolvingId === valve.pendingCommand!.id ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.resolveBtnText}>⚡ Sincronizar / Desbloquear Actuador</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Nota informativa para el Asesor */}
                {isAdvisor && !hasPending && (
                  <View style={styles.advisorNotice}>
                    <Text style={styles.advisorNoticeText}>
                      🔒 Modo consulta: Tu rol de Asesor no puede emitir comandos de riego.
                    </Text>
                  </View>
                )}

                {/* Botón de Acción Principal */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    hasPending || isAdvisor
                      ? styles.actionBtnDisabled
                      : isOpen
                      ? styles.actionBtnClose
                      : styles.actionBtnOpen,
                  ]}
                  onPress={() => onOpenCommandModal(valve)}
                  disabled={hasPending || isAdvisor}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      (hasPending || isAdvisor) && styles.actionBtnTextDisabled,
                    ]}
                  >
                    {hasPending
                      ? '⏳ Comando en ejecución...'
                      : isAdvisor
                      ? '🔒 Solo lectura'
                      : isOpen
                      ? '🛑 Cerrar Válvula'
                      : '💧 Abrir Válvula'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  countBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  sectionDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  valvesList: {
    gap: 12,
  },
  valveCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  valveInfoCol: {
    flex: 1,
    marginRight: 12,
  },
  valveName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1e293b',
  },
  valveMeta: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  pillOpen: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  pillClosed: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  pillPending: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textOpen: {
    color: '#15803d',
  },
  textClosed: {
    color: '#475569',
  },
  textPending: {
    color: '#b45309',
  },
  pendingNotice: {
    backgroundColor: '#fffbeb',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  pendingNoticeText: {
    fontSize: 11,
    color: '#92400e',
    fontWeight: '500',
  },
  resolveBtn: {
    marginTop: 8,
    backgroundColor: '#d97706',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolveBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  advisorNotice: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  advisorNoticeText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  actionBtn: {
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 10,
  },
  actionBtnOpen: {
    backgroundColor: '#0284c7',
  },
  actionBtnClose: {
    backgroundColor: '#dc2626',
  },
  actionBtnDisabled: {
    backgroundColor: '#e2e8f0',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  actionBtnTextDisabled: {
    color: '#94a3b8',
  },
});
