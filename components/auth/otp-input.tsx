import React, { useImperativeHandle, useMemo, useRef, forwardRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

type Props = {
  length: number;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

export type OtpInputHandle = {
  focusFirst: () => void;
  blurLast: () => void;
};

export const OtpInput = forwardRef<OtpInputHandle, Props>(function OtpInput(
  { length, value, onChange, disabled, autoFocus },
  ref
) {
  const inputsRef = useRef<Array<TextInput | null>>([]);

  const indexes = useMemo(() => Array.from({ length }, (_, i) => i), [length]);

  useImperativeHandle(
    ref,
    () => ({
      focusFirst: () => inputsRef.current[0]?.focus(),
      blurLast: () => inputsRef.current[Math.max(0, length - 1)]?.blur(),
    }),
    [length]
  );

  return (
    <View style={styles.row}>
      {indexes.map((idx) => (
        <TextInput
          // eslint-disable-next-line react/no-array-index-key
          key={idx}
          ref={(r) => {
            inputsRef.current[idx] = r;
          }}
          editable={!disabled}
          value={value[idx] ?? ''}
          onChangeText={(t) => {
            const digits = t.replace(/[^0-9]/g, '');
            if (!digits) {
              const next = [...value];
              next[idx] = '';
              onChange(next);
              return;
            }

            const next = [...value];
            let writeAt = idx;
            for (const ch of digits) {
              if (writeAt >= length) break;
              next[writeAt] = ch;
              writeAt += 1;
            }
            onChange(next);

            const nextIndex = Math.min(writeAt, length - 1);
            if (writeAt >= length) {
              inputsRef.current[length - 1]?.blur();
            } else {
              inputsRef.current[nextIndex]?.focus();
            }
          }}
          onKeyPress={(e) => {
            if (e.nativeEvent.key !== 'Backspace') return;
            if (value[idx]) return;
            if (idx <= 0) return;
            inputsRef.current[idx - 1]?.focus();
          }}
          keyboardType="number-pad"
          maxLength={1}
          placeholder="•"
          placeholderTextColor="rgba(255,255,255,0.25)"
          style={styles.cell}
          autoFocus={autoFocus && idx === 0}
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    rowGap: 10,
    columnGap: 8,
    maxWidth: 440,
    marginBottom: 20,
  },
  cell: {
    width: 46,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    textAlign: 'center',
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
});
