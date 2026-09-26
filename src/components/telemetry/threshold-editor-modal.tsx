import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '@/lib/supabase';

interface ThresholdEditorModalProps {
  visible: boolean;
  plotId: string;
  plotName: string;
  currentMin: number;
  currentMax: number;
  isProducer: boolean;
  onClose: () => void;
  onSuccess: (newMin: number, newMax: number) => void;
}

export function ThresholdEditorModal({
  visible,
  plotId,
  plotName,
  currentMin,
  currentMax,
  isProducer,
  onClose,
  onSuccess,
}: ThresholdEditorModalProps) {
  const [min, setMin] = useState<number>(currentMin);
  const [max, setMax] = useState<number>(currentMax);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    if (min >= max) {
      setErrorMsg('El umbral mínimo debe ser menor que el umbral máximo.');
      return;
    }
    if (min < 5 || max > 95) {
      setErrorMsg('Los umbrales deben estar entre 5% y 95%.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase
        .from('plots')
        .update({
          threshold_min: min,
          threshold_max: max,
        })
        .eq('id', plotId);

      if (error) {
        throw error;
      }

      onSuccess(min, max);
      onClose();
    } catch (err: any) {
      console.error('[ThresholdEditor] Error al actualizar umbrales:', err);
      setErrorMsg(err?.message || 'Error al persistir umbrales en base de datos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          {/* Cabecera */}
          <View style={styles.header}>
            <Text style={styles.title}>Configurar Umbrales de Riego</Text>
            <Text style={styles.subtitle}>Lote: {plotName}</Text>
          </View>

          {!isProducer ? (
            <View style={styles.forbiddenBox}>
              <Text style={styles.forbiddenIcon}>🔒</Text>
              <Text style={styles.forbiddenTitle}>Acceso Restringido</Text>
              <Text style={styles.forbiddenText}>
                Solo el rol <Text style={{ fontWeight: 'bold' }}>Productor</Text> tiene permisos para
                modificar los umbrales de humedad de este lote. Los roles Operador y Asesor tienen acceso
                de solo lectura sobre estos parámetros según las políticas de seguridad (RLS).
              </Text>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {errorMsg && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}

              {/* Ajuste de Umbral Mínimo (RF-11) */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>Umbral Mínimo (Seco)</Text>
                  <Text style={[styles.sectionVal, { color: '#dc2626' }]}>{min}%</Text>
                </View>
                <Text style={styles.hint}>
                  Si la humedad cae por debajo de este valor, el lote se marcará como Seco (Rojo).
                </Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setMin((prev) => Math.max(5, prev - 5))}
                  >
                    <Text style={styles.stepBtnText}>-5</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setMin((prev) => Math.max(5, prev - 1))}
                  >
                    <Text style={styles.stepBtnText}>-1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setMin((prev) => Math.min(max - 1, prev + 1))}
                  >
                    <Text style={styles.stepBtnText}>+1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setMin((prev) => Math.min(max - 5, prev + 5))}
                  >
                    <Text style={styles.stepBtnText}>+5</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Ajuste de Umbral Máximo */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>Umbral Máximo (Húmedo)</Text>
                  <Text style={[styles.sectionVal, { color: '#2563eb' }]}>{max}%</Text>
                </View>
                <Text style={styles.hint}>
                  Si la humedad supera este valor, el lote se considerará Húmedo (Azul).
                </Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setMax((prev) => Math.max(min + 5, prev - 5))}
                  >
                    <Text style={styles.stepBtnText}>-5</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setMax((prev) => Math.max(min + 1, prev - 1))}
                  >
                    <Text style={styles.stepBtnText}>-1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setMax((prev) => Math.min(95, prev + 1))}
                  >
                    <Text style={styles.stepBtnText}>+1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setMax((prev) => Math.min(95, prev + 5))}
                  >
                    <Text style={styles.stepBtnText}>+5</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Previsualización del rango óptimo */}
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>Rango Óptimo de Riego:</Text>
                <Text style={styles.previewText}>
                  🟢 Óptimo entre <Text style={styles.bold}>{min}%</Text> y{' '}
                  <Text style={styles.bold}>{max}%</Text>
                </Text>
              </View>

              {/* Acciones */}
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, loading && styles.disabledBtn]}
                  onPress={handleSave}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Guardar Umbrales</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  sectionVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  hint: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stepBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  stepBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  previewBox: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
  },
  previewText: {
    fontSize: 13,
    color: '#15803d',
    marginTop: 2,
  },
  bold: {
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#166534',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledBtn: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  forbiddenBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  forbiddenIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  forbiddenTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  forbiddenText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
});
