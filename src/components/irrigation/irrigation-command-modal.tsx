import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { ValveWithCommand } from '@/hooks/use-plot-valves';

interface IrrigationCommandModalProps {
  visible: boolean;
  valve: ValveWithCommand | null;
  isAdvisor: boolean;
  onClose: () => void;
  onSubmit: (params: {
    valveId: string;
    action: 'open' | 'close';
    durationMin?: number;
  }) => Promise<void>;
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export function IrrigationCommandModal({
  visible,
  valve,
  isAdvisor,
  onClose,
  onSubmit,
}: IrrigationCommandModalProps) {
  const [action, setAction] = useState<'open' | 'close'>('open');
  const [durationMin, setDurationMin] = useState<number>(30);
  const [durationInput, setDurationInput] = useState<string>('30');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Al abrir el modal o cambiar de válvula, sugerir la acción contraria a la actual
  useEffect(() => {
    if (valve) {
      const suggestedAction = valve.status === 'open' ? 'close' : 'open';
      setAction(suggestedAction);
      setDurationMin(30);
      setDurationInput('30');
      setErrorMessage(null);
    }
  }, [valve, visible]);

  if (!valve) return null;

  const hasPending = !!valve.pendingCommand;
  const isOpen = valve.status === 'open';

  const handleDurationChange = (text: string) => {
    setDurationInput(text);
    const parsed = parseInt(text, 10);
    if (!isNaN(parsed)) {
      setDurationMin(parsed);
    }
  };

  const adjustDuration = (delta: number) => {
    const next = Math.min(120, Math.max(1, durationMin + delta));
    setDurationMin(next);
    setDurationInput(next.toString());
  };

  const handleSelectPreset = (minutes: number) => {
    setDurationMin(minutes);
    setDurationInput(minutes.toString());
  };

  const handleConfirm = async () => {
    setErrorMessage(null);

    if (action === 'open') {
      if (isNaN(durationMin) || durationMin < 1 || durationMin > 120) {
        setErrorMessage('La duración debe estar entre 1 y 120 minutos.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        valveId: valve.id,
        action,
        durationMin: action === 'open' ? durationMin : undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error al emitir el comando');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardContainer}
          >
            <View style={styles.modalCard}>
              {/* Encabezado */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Comando de Riego</Text>
                  <Text style={styles.valveSubtitle}>{valve.name}</Text>
                </View>
                <TouchableOpacity onPress={onClose} disabled={submitting}>
                  <Text style={styles.closeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Estado actual de la válvula */}
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Estado actual:</Text>
                <View
                  style={[
                    styles.statusPill,
                    isOpen ? styles.statusPillOpen : styles.statusPillClosed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isOpen ? styles.statusTextOpen : styles.statusTextClosed,
                    ]}
                  >
                    {isOpen ? '💧 Abierta' : '🔒 Cerrada'}
                  </Text>
                </View>
              </View>

              {/* Selector de Acción (Abrir / Cerrar) */}
              <View style={styles.actionSelector}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    action === 'open' && styles.actionBtnActiveOpen,
                  ]}
                  onPress={() => setAction('open')}
                  disabled={submitting}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      action === 'open' && styles.actionBtnTextActive,
                    ]}
                  >
                    💧 Abrir Válvula
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    action === 'close' && styles.actionBtnActiveClose,
                  ]}
                  onPress={() => setAction('close')}
                  disabled={submitting}
                >
                  <Text
                    style={[
                      styles.actionBtnText,
                      action === 'close' && styles.actionBtnTextActive,
                    ]}
                  >
                    🛑 Cerrar Válvula
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Contenido según Acción */}
              {action === 'open' ? (
                <View style={styles.durationSection}>
                  <Text style={styles.sectionLabel}>
                    Duración del Riego (1 a 120 min)
                  </Text>

                  {/* Selector con Stepper */}
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => adjustDuration(-5)}
                      disabled={durationMin <= 1 || submitting}
                    >
                      <Text style={styles.stepBtnText}>-5</Text>
                    </TouchableOpacity>

                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.durationInput}
                        value={durationInput}
                        onChangeText={handleDurationChange}
                        keyboardType="number-pad"
                        maxLength={3}
                        editable={!submitting}
                      />
                      <Text style={styles.minSuffix}>min</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => adjustDuration(5)}
                      disabled={durationMin >= 120 || submitting}
                    >
                      <Text style={styles.stepBtnText}>+5</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Chips de Selección Rápida */}
                  <View style={styles.presetChips}>
                    {DURATION_PRESETS.map((preset) => (
                      <TouchableOpacity
                        key={preset}
                        style={[
                          styles.presetChip,
                          durationMin === preset && styles.presetChipActive,
                        ]}
                        onPress={() => handleSelectPreset(preset)}
                        disabled={submitting}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            durationMin === preset && styles.presetChipTextActive,
                          ]}
                        >
                          {preset}m
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <View style={styles.closeWarningBox}>
                  <Text style={styles.closeWarningTitle}>Interrupción Inmediata</Text>
                  <Text style={styles.closeWarningText}>
                    Al enviar esta orden, el actuador en campo cerrará la válvula inmediatamente deteniendo el paso de agua.
                  </Text>
                </View>
              )}

              {/* Restricción de Rol Asesor */}
              {isAdvisor && (
                <View style={styles.blockedBox}>
                  <Text style={styles.blockedTitle}>🔒 Permiso Insuficiente</Text>
                  <Text style={styles.blockedText}>
                    Tu rol de Asesor posee permisos de solo lectura. Solo Productores y Operadores pueden emitir órdenes de riego.
                  </Text>
                </View>
              )}

              {/* Restricción de Comando Pendiente (RF-16) */}
              {hasPending && (
                <View style={styles.pendingBox}>
                  <Text style={styles.pendingTitle}>⏳ Comando en Curso (RF-16)</Text>
                  <Text style={styles.pendingText}>
                    Ya existe una orden de riego en proceso para esta válvula. Debe esperar a que finalice para enviar una nueva orden.
                  </Text>
                </View>
              )}

              {/* Mensaje de Error */}
              {errorMessage && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
                </View>
              )}

              {/* Pie de Garantía de Idempotencia */}
              <View style={styles.idempotencyTag}>
                <Text style={styles.idempotencyText}>
                  🛡️ Transacción protegida con UUID de idempotencia (RF-14).
                </Text>
              </View>

              {/* Botones de Acción */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={submitting}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    (isAdvisor || hasPending || submitting) && styles.confirmBtnDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={isAdvisor || hasPending || submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmBtnText}>
                      {action === 'open' ? 'Enviar Orden de Apertura' : 'Enviar Orden de Cierre'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 440,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  valveSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  closeIcon: {
    fontSize: 20,
    color: '#94a3b8',
    fontWeight: '600',
    padding: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
  },
  statusLabel: {
    fontSize: 13,
    color: '#64748b',
    marginRight: 8,
    fontWeight: '500',
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusPillOpen: {
    backgroundColor: '#dcfce7',
  },
  statusPillClosed: {
    backgroundColor: '#f1f5f9',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextOpen: {
    color: '#15803d',
  },
  statusTextClosed: {
    color: '#475569',
  },
  actionSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  actionBtnActiveOpen: {
    backgroundColor: '#0284c7',
  },
  actionBtnActiveClose: {
    backgroundColor: '#dc2626',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  actionBtnTextActive: {
    color: '#ffffff',
  },
  durationSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepBtn: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#0284c7',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    backgroundColor: '#f8fafc',
  },
  durationInput: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    paddingVertical: 6,
    textAlign: 'center',
    minWidth: 44,
  },
  minSuffix: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 4,
    fontWeight: '600',
  },
  presetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  presetChip: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  presetChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#0284c7',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#ffffff',
  },
  closeWarningBox: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  closeWarningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#be123c',
    marginBottom: 4,
  },
  closeWarningText: {
    fontSize: 12,
    color: '#881337',
    lineHeight: 17,
  },
  blockedBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  blockedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#dc2626',
    marginBottom: 2,
  },
  blockedText: {
    fontSize: 11,
    color: '#7f1d1d',
  },
  pendingBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  pendingTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
    marginBottom: 2,
  },
  pendingText: {
    fontSize: 11,
    color: '#78350f',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '500',
  },
  idempotencyTag: {
    marginBottom: 18,
    alignItems: 'center',
  },
  idempotencyText: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#166534',
  },
  confirmBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.65,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
