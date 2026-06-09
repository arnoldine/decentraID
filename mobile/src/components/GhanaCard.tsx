import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface GhanaCardProps {
  surname?: string;
  forenames?: string;
  dateOfBirth?: string;
  gender?: string;
  cardNumber: string;
  photoBase64?: string;
}

export default function GhanaCard({
  surname,
  forenames,
  dateOfBirth,
  gender,
  cardNumber,
  photoBase64,
}: GhanaCardProps) {
  return (
    <View style={styles.card}>
      {/* Background pattern overlay */}
      <View style={styles.patternOverlay} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.coatOfArmsPlaceholder}>
          <Text style={styles.coatText}>GH</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.countryName}>REPUBLIC OF GHANA</Text>
          <Text style={styles.authorityName}>NATIONAL IDENTIFICATION AUTHORITY</Text>
          <Text style={styles.cardTitle}>GHANA CARD</Text>
        </View>
        <View style={styles.flagStripes}>
          <View style={[styles.stripe, { backgroundColor: '#CE1126' }]} />
          <View style={[styles.stripe, { backgroundColor: '#FCD116' }]} />
          <View style={[styles.stripe, { backgroundColor: '#006B3F' }]} />
        </View>
      </View>

      {/* Divider */}
      <View style={styles.goldDivider} />

      {/* Body */}
      <View style={styles.body}>
        {/* Photo */}
        <View style={styles.photoContainer}>
          {photoBase64 ? (
            <Image
              source={{ uri: `data:image/jpeg;base64,${photoBase64}` }}
              style={styles.photo}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>👤</Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.details}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>SURNAME</Text>
            <Text style={styles.fieldValue}>{surname ?? '—'}</Text>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>FORENAMES</Text>
            <Text style={styles.fieldValue} numberOfLines={1}>{forenames ?? '—'}</Text>
          </View>
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>DATE OF BIRTH</Text>
              <Text style={styles.fieldValue}>{dateOfBirth ?? '—'}</Text>
            </View>
            <View style={[styles.fieldGroup, { flex: 0.6 }]}>
              <Text style={styles.fieldLabel}>SEX</Text>
              <Text style={styles.fieldValue}>{gender ?? '—'}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Card number */}
      <View style={styles.cardNumberRow}>
        <Text style={styles.cardNumberLabel}>CARD NUMBER</Text>
        <Text style={styles.cardNumber}>{cardNumber}</Text>
      </View>
    </View>
  );
}

const GOLD = '#b8860b';
const DARK_GREEN = '#0d2b0d';
const MID_GREEN = '#1a3a1a';
const LIGHT_GREEN = '#9dc08b';
const WHITE = '#ffffff';

const styles = StyleSheet.create({
  card: {
    backgroundColor: DARK_GREEN,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GOLD,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  patternOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    opacity: 0.03,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: MID_GREEN,
    gap: 8,
  },
  coatOfArmsPlaceholder: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coatText: {
    color: DARK_GREEN,
    fontWeight: 'bold',
    fontSize: 13,
  },
  headerText: {
    flex: 1,
  },
  countryName: {
    color: GOLD,
    fontWeight: 'bold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  authorityName: {
    color: LIGHT_GREEN,
    fontSize: 7.5,
    letterSpacing: 0.3,
  },
  cardTitle: {
    color: WHITE,
    fontWeight: 'bold',
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 1,
  },
  flagStripes: {
    width: 6,
    height: 34,
    borderRadius: 2,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  stripe: {
    flex: 1,
  },
  goldDivider: {
    height: 1.5,
    backgroundColor: GOLD,
    opacity: 0.7,
    marginHorizontal: 14,
  },
  body: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  photoContainer: {
    width: 80,
    height: 100,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2d4a2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 30,
  },
  details: {
    flex: 1,
    gap: 8,
  },
  fieldGroup: {
    gap: 1,
  },
  fieldLabel: {
    color: GOLD,
    fontSize: 8,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  fieldValue: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  cardNumberRow: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: GOLD + '44',
    marginTop: 4,
    gap: 2,
  },
  cardNumberLabel: {
    color: GOLD,
    fontSize: 8,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  cardNumber: {
    color: LIGHT_GREEN,
    fontFamily: 'monospace',
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: 'bold',
  },
});
