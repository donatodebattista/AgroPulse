import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { CommandFeedback } from '@/hooks/use-plot-valves';

interface CommandFeedbackBannerProps {
  feedback: CommandFeedback | null;
  onDismiss: () => void;
}

export function CommandFeedbackBanner({ feedback, onDismiss }: CommandFeedbackBannerProps) {
  if (!feedback) return null;

  const isPending = feedback.status === 'pending';
  const isApplied = feedback.status === 'applied';
  const isFailed = feedback.status === 'failed';
  const isTimeout = feedback.status === 'timeout';

  let containerStyle = styles.pendingContainer;
  let icon = '⏳';
  let title = 'Orden en curso';

  if (isApplied) {
    containerStyle = styles.appliedContainer;
    icon = '✅';
    title = 'Orden Aplicada con Éxito';
  } else if (isFailed) {
    containerStyle = styles.failedContainer;
    icon = '❌';
    title = 'Error en el Actuador';
  } else if (isTimeout) {
    containerStyle = styles.timeoutContainer;
    icon = 'ℹ️';
    title = 'Procesamiento en Campo (RNF-05)';
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.headerRow}>
        <View style={styles.titleRow}>
          {isPending ? (
            <ActivityIndicator size="small" color="#0369a1" style={{ marginRight: 8 }} />
          ) : (
            <Text style={styles.icon}>{icon}</Text>
          )}
          <Text style={styles.title}>{title}</Text>
        </View>

        {!isPending && (
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.messageText}>{feedback.message}</Text>

      {isPending && (
        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            Validando con el actuador IoT (≤ 5 s). La interfaz permanece interactiva.
          </Text>
        </View>
      )}

      {isTimeout && (
        <TouchableOpacity style={styles.dismissPill} onPress={onDismiss}>
          <Text style={styles.dismissPillText}>Entendido</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
  },
  pendingContainer: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  appliedContainer: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  failedContainer: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  timeoutContainer: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  closeBtn: {
    fontSize: 15,
    color: '#64748b',
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  messageText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  footerNote: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#bae6fd',
  },
  footerNoteText: {
    fontSize: 11,
    color: '#0284c7',
    fontStyle: 'italic',
  },
  dismissPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#d97706',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dismissPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
