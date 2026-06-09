import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Modal,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, ServerSettings, VerificationResponse } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { CameraIcon, NfcIcon, CheckIcon, XIcon, RotateIcon } from '../components/Icons';
import GhanaCard from '../components/GhanaCard';
import { isNfcSupported, isNfcEnabled, readNfcTag, cleanupNfc } from '../services/NfcService';
import { verifyIdentity, fetchSettings } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'Verification'>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GHANA_CARD_PATTERN = /^GHA-\d{9}-\d$/;

type VerificationStep = 'nfc' | 'camera' | 'verify';

export default function VerificationScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Server/auth
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [serverSettings, setServerSettings] = useState<ServerSettings | null>(null);

  // Step tracking
  const [currentStep, setCurrentStep] = useState<VerificationStep>('nfc');
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcScanned, setNfcScanned] = useState(false);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [showNfcScan, setShowNfcScan] = useState(false);

  // Card number
  const [ghanaCardNumber, setGhanaCardNumber] = useState('');
  const [cardNumberError, setCardNumberError] = useState('');

  // Camera
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Result
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<VerificationResponse | null>(null);
  const [error, setError] = useState('');

  // Animation
  const nfcPulse = useRef(new Animated.Value(1)).current;
  const scanLine = useRef(new Animated.Value(0)).current;
  const cameraRef = useRef<CameraView>(null);

  // Load auth on mount
  useEffect(() => {
    async function loadAuth() {
      try {
        const [storedToken, storedUrl] = await Promise.all([
          AsyncStorage.getItem('auth_token'),
          AsyncStorage.getItem('server_url'),
        ]);
        if (!storedToken || !storedUrl) {
          navigation.navigate('Login');
          return;
        }
        setToken(storedToken);
        setServerUrl(storedUrl);
        const settings = await fetchSettings(storedUrl, storedToken);
        setServerSettings(settings);
      } catch {
        navigation.navigate('Login');
      }
    }
    loadAuth();
  }, []);

  // Check NFC support
  useEffect(() => {
    async function checkNfc() {
      const supported = await isNfcSupported();
      setNfcSupported(supported);
    }
    checkNfc();
  }, []);

  // NFC pulse animation
  useEffect(() => {
    if (showNfcScan) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(nfcPulse, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(nfcPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [showNfcScan]);

  // Camera scan line animation
  useEffect(() => {
    if (showCamera) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLine, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(scanLine, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [showCamera]);

  async function startNfcScan() {
    const enabled = await isNfcEnabled();
    if (!enabled) {
      Alert.alert('NFC Disabled', 'Please enable NFC in your device settings');
      return;
    }
    setNfcScanning(true);
    setShowNfcScan(true);
    try {
      const cardData = await readNfcTag();
      setGhanaCardNumber(cardData.cardNumber);
      setNfcScanned(true);
      setShowNfcScan(false);
      setCurrentStep('camera');
    } catch (err: any) {
      Alert.alert('NFC Error', err.message ?? 'Failed to read NFC tag');
    } finally {
      setNfcScanning(false);
    }
  }

  async function stopNfcScan() {
    await cleanupNfc();
    setNfcScanning(false);
    setShowNfcScan(false);
  }

  function skipNfc() {
    setCurrentStep('camera');
    setShowNfcScan(false);
  }

  function handleCardNumberChange(text: string) {
    const val = text.toUpperCase();
    setGhanaCardNumber(val);
    if (val && !GHANA_CARD_PATTERN.test(val)) {
      setCardNumberError('Format: GHA-XXXXXXXXX-X');
    } else {
      setCardNumberError('');
    }
  }

  async function openCamera() {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to capture a selfie');
        return;
      }
    }
    setShowCamera(true);
    setCameraStarted(true);
  }

  async function capturePhoto() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9, base64: false });
      if (!photo) return;

      // Crop center and resize to 480x640
      const { width: w, height: h } = photo;
      const targetAspect = 480 / 640;
      const sourceAspect = w / h;

      let cropX = 0, cropY = 0, cropWidth = w, cropHeight = h;
      if (sourceAspect > targetAspect) {
        cropWidth = h * targetAspect;
        cropX = (w - cropWidth) / 2;
      } else {
        cropHeight = w / targetAspect;
        cropY = (h - cropHeight) / 2;
      }

      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [
          { crop: { originX: cropX, originY: cropY, width: cropWidth, height: cropHeight } },
          { resize: { width: 480, height: 640 } },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.PNG, base64: true }
      );

      setCapturedImage(manipulated.base64 ? `data:image/png;base64,${manipulated.base64}` : manipulated.uri);
      setShowCamera(false);
      setCameraStarted(false);
      setCurrentStep('verify');
    } catch (err: any) {
      Alert.alert('Camera Error', err.message ?? 'Failed to capture photo');
    }
  }

  const toggleCameraFacing = useCallback(() => {
    setCameraFacing((f) => (f === 'front' ? 'back' : 'front'));
  }, []);

  async function handleVerify() {
    if (!GHANA_CARD_PATTERN.test(ghanaCardNumber)) {
      setCardNumberError('Format: GHA-XXXXXXXXX-X');
      return;
    }
    if (!capturedImage) {
      setError('Please capture a selfie first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const base64 = capturedImage.replace(/^data:image\/png;base64,/, '').replace(/^data:image\/jpeg;base64,/, '');
      const result = await verifyIdentity(serverUrl, token, ghanaCardNumber, base64, true);
      setResponse(result);
    } catch (err: any) {
      setError(err.message ?? 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setCurrentStep('nfc');
    setGhanaCardNumber('');
    setCapturedImage(null);
    setResponse(null);
    setError('');
    setCardNumberError('');
    setNfcScanned(false);
  }

  function handleLogout() {
    AsyncStorage.multiRemove(['auth_token']).then(() => navigation.navigate('Login'));
  }

  // ── NFC Modal ──────────────────────────────────────────────────────────
  const renderNfcModal = () => (
    <Modal visible={showNfcScan} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.nfcFullScreen, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.nfcCloseButton} onPress={stopNfcScan}>
          <XIcon size={24} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={[styles.nfcTitle, { color: colors.text }]}>NFC Scan</Text>
        <Text style={[styles.nfcSubtitle, { color: colors.textMuted }]}>
          Hold your Ghana Card to the back of your device
        </Text>

        <Animated.View style={[styles.nfcIconContainer, { transform: [{ scale: nfcPulse }] }]}>
          <View style={[styles.nfcIconCircle, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
            <NfcIcon size={80} color={colors.primary} />
          </View>
        </Animated.View>

        {nfcScanning && (
          <View style={styles.nfcScanningRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.nfcScanningText, { color: colors.textMuted }]}>Scanning for NFC tag…</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.nfcSkipButton]}
          onPress={skipNfc}
          activeOpacity={0.7}
        >
          <Text style={[styles.nfcSkipText, { color: colors.primary }]}>Skip NFC Scan</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  // ── Camera Modal ──────────────────────────────────────────────────────
  const renderCameraModal = () => (
    <Modal visible={showCamera} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.cameraFullScreen}>
        {cameraStarted && (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={cameraFacing}
          />
        )}

        {/* Dark overlay with frame cutout simulation */}
        <View style={styles.cameraOverlay} pointerEvents="none">
          <View style={styles.cameraOverlayTop} />
          <View style={styles.cameraOverlayMiddle}>
            <View style={styles.cameraOverlaySide} />
            <View style={styles.cameraFrame}>
              {/* Corner markers */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              {/* Scan line */}
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    transform: [{
                      translateY: scanLine.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, FRAME_HEIGHT - 2],
                      }),
                    }],
                  },
                ]}
              />
            </View>
            <View style={styles.cameraOverlaySide} />
          </View>
          <View style={styles.cameraOverlayBottom} />
        </View>

        {/* Top bar */}
        <View style={styles.cameraTopBar}>
          <TouchableOpacity onPress={() => { setShowCamera(false); setCameraStarted(false); }} style={styles.cameraTopButton}>
            <XIcon size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.cameraTopTitle}>Position your face in the frame</Text>
          <TouchableOpacity onPress={toggleCameraFacing} style={styles.cameraTopButton}>
            <RotateIcon size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Capture button */}
        <View style={styles.cameraBottomBar}>
          <TouchableOpacity style={styles.captureButton} onPress={capturePhoto} activeOpacity={0.8}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ── Result view ───────────────────────────────────────────────────────
  if (response) {
    const isKyc = serverSettings?.defaultVerificationType === 'kyc';
    const person = response.data?.person;
    const verified = response.data?.verified === 'TRUE' || response.success;

    return (
      <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={styles.resultContent}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Verification Result</Text>

        {isKyc && person ? (
          <View style={styles.resultCard}>
            <View style={styles.verifiedBanner}>
              {verified ? (
                <View style={[styles.verifiedBadge, { backgroundColor: colors.success + '22', borderColor: colors.success }]}>
                  <CheckIcon size={20} color={colors.success} />
                  <Text style={[styles.verifiedBadgeText, { color: colors.success }]}>Identity Verified</Text>
                </View>
              ) : (
                <View style={[styles.verifiedBadge, { backgroundColor: colors.error + '22', borderColor: colors.error }]}>
                  <XIcon size={20} color={colors.error} />
                  <Text style={[styles.verifiedBadgeText, { color: colors.error }]}>Verification Failed</Text>
                </View>
              )}
            </View>
            <GhanaCard
              surname={person.surname ?? person.Surname}
              forenames={person.forenames ?? person.Forenames ?? person.firstName}
              dateOfBirth={person.dateOfBirth ?? person.DateOfBirth ?? person.dob}
              gender={person.gender ?? person.Gender}
              cardNumber={ghanaCardNumber}
              photoBase64={response.data?.image}
            />
          </View>
        ) : (
          <View style={[
            styles.yesNoBanner,
            { backgroundColor: verified ? colors.success + '22' : colors.error + '22', borderColor: verified ? colors.success : colors.error }
          ]}>
            <View style={styles.yesNoIcon}>
              {verified ? <CheckIcon size={48} color={colors.success} /> : <XIcon size={48} color={colors.error} />}
            </View>
            <Text style={[styles.yesNoTitle, { color: verified ? colors.success : colors.error }]}>
              {verified ? 'Identity Verified' : 'Verification Failed'}
            </Text>
            {response.data?.reason && (
              <Text style={[styles.yesNoReason, { color: colors.textMuted }]}>{response.data.reason}</Text>
            )}
            {response.message && (
              <Text style={[styles.yesNoReason, { color: colors.textMuted }]}>{response.message}</Text>
            )}
          </View>
        )}

        {response.data?.transactionGuid && (
          <Text style={[styles.transactionId, { color: colors.textMuted }]}>
            TXN: {response.data.transactionGuid}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={resetAll}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>New Verification</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── Main verification flow ─────────────────────────────────────────────
  const steps: { key: VerificationStep; label: string }[] = [
    { key: 'nfc', label: 'NFC Scan' },
    { key: 'camera', label: 'Selfie' },
    { key: 'verify', label: 'Verify' },
  ];
  const stepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {renderNfcModal()}
      {renderCameraModal()}

      <ScrollView contentContainerStyle={styles.mainContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Identity Verification</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={[styles.logoutText, { color: colors.textMuted }]}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {steps.map((s, i) => (
            <React.Fragment key={s.key}>
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  {
                    backgroundColor: i < stepIndex ? colors.primary : i === stepIndex ? colors.primary + '33' : colors.surfaceVariant,
                    borderColor: i <= stepIndex ? colors.primary : colors.border,
                  }
                ]}>
                  {i < stepIndex ? (
                    <CheckIcon size={14} color="#ffffff" />
                  ) : (
                    <Text style={[styles.stepNumber, { color: i === stepIndex ? colors.primary : colors.textMuted }]}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, { color: i === stepIndex ? colors.primary : colors.textMuted }]}>{s.label}</Text>
              </View>
              {i < steps.length - 1 && (
                <View style={[styles.stepLine, { backgroundColor: i < stepIndex ? colors.primary : colors.border }]} />
              )}
            </React.Fragment>
          ))}
        </View>

        {/* NFC Step */}
        {currentStep === 'nfc' && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>NFC Card Scan</Text>
            <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
              {nfcSupported
                ? 'Tap your Ghana Card to the back of your phone to automatically read your card number.'
                : 'NFC is not supported on this device. Enter your card number manually below.'}
            </Text>

            {nfcSupported && (
              <TouchableOpacity
                style={[styles.secondaryButton, { backgroundColor: colors.primary, marginBottom: 12 }]}
                onPress={startNfcScan}
                activeOpacity={0.8}
              >
                <NfcIcon size={18} color="#ffffff" />
                <Text style={styles.secondaryButtonText}>Start NFC Scan</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: colors.border }]}
              onPress={skipNfc}
              activeOpacity={0.7}
            >
              <Text style={[styles.outlineButtonText, { color: colors.textMuted }]}>
                {nfcSupported ? 'Skip — Enter Manually' : 'Continue to Selfie'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Camera Step */}
        {currentStep === 'camera' && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Card Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: cardNumberError ? colors.error : colors.border }]}
              value={ghanaCardNumber}
              onChangeText={handleCardNumberChange}
              placeholder="GHA-123456789-0"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              maxLength={15}
            />
            {cardNumberError ? (
              <Text style={[styles.errorText, { color: colors.error }]}>{cardNumberError}</Text>
            ) : null}

            <View style={styles.divider} />

            <Text style={[styles.cardTitle, { color: colors.text }]}>Selfie Photo</Text>
            <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
              Take a clear photo of your face for biometric matching.
            </Text>

            {capturedImage ? (
              <View style={styles.capturePreview}>
                <Image source={{ uri: capturedImage }} style={styles.capturePreviewImage} resizeMode="cover" />
                <TouchableOpacity
                  style={[styles.retakeButton, { backgroundColor: colors.surfaceVariant }]}
                  onPress={openCamera}
                  activeOpacity={0.8}
                >
                  <RotateIcon size={16} color={colors.text} />
                  <Text style={[styles.retakeButtonText, { color: colors.text }]}>Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: 0 }]}
                  onPress={() => setCurrentStep('verify')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>Continue to Verify</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.cameraOpenButton, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
                onPress={openCamera}
                activeOpacity={0.8}
              >
                <CameraIcon size={32} color={colors.textMuted} />
                <Text style={[styles.cameraOpenText, { color: colors.textMuted }]}>Tap to Open Camera</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Verify Step */}
        {currentStep === 'verify' && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Ready to Verify</Text>

            <View style={[styles.summaryRow, { backgroundColor: colors.surfaceVariant, borderRadius: 10, padding: 12 }]}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Card Number</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{ghanaCardNumber || 'Not set'}</Text>
            </View>

            <View style={[styles.summaryRow, { backgroundColor: colors.surfaceVariant, borderRadius: 10, padding: 12, marginTop: 8 }]}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Selfie</Text>
              {capturedImage ? (
                <View style={styles.summaryPhotoRow}>
                  <Image source={{ uri: capturedImage }} style={styles.summaryPhoto} />
                  <Text style={[styles.summaryValue, { color: colors.success }]}>Captured</Text>
                </View>
              ) : (
                <Text style={[styles.summaryValue, { color: colors.error }]}>Not captured</Text>
              )}
            </View>

            {error ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.error + '22', borderColor: colors.error }]}>
                <Text style={[styles.errorBannerText, { color: colors.error }]}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: loading ? colors.surfaceVariant : colors.primary }]}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Verify Identity</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.outlineButton, { borderColor: colors.border, marginTop: 8 }]}
              onPress={() => setCurrentStep('camera')}
              activeOpacity={0.7}
            >
              <Text style={[styles.outlineButtonText, { color: colors.textMuted }]}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const FRAME_WIDTH = SCREEN_WIDTH * 0.65;
const FRAME_HEIGHT = FRAME_WIDTH * (640 / 480);
const CORNER_SIZE = 20;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  mainContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  logoutText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  resultContent: {
    padding: 20,
    paddingBottom: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  stepLine: {
    width: 40,
    height: 2,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  divider: {
    height: 1,
    backgroundColor: '#ffffff11',
    marginVertical: 4,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  errorText: {
    fontSize: 12,
    marginTop: -4,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  outlineButton: {
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  outlineButtonText: {
    fontWeight: '500',
    fontSize: 14,
  },
  cameraOpenButton: {
    height: 140,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  cameraOpenText: {
    fontSize: 14,
    fontWeight: '500',
  },
  capturePreview: {
    gap: 10,
  },
  capturePreviewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retakeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  summaryPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryPhoto: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  errorBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  errorBannerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  // NFC Modal
  nfcFullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  nfcCloseButton: {
    position: 'absolute',
    top: 52,
    right: 24,
    padding: 8,
  },
  nfcTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  nfcSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 48,
    paddingHorizontal: 20,
  },
  nfcIconContainer: {
    marginBottom: 48,
  },
  nfcIconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcScanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  nfcScanningText: {
    fontSize: 14,
  },
  nfcSkipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  nfcSkipText: {
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  // Camera Modal
  cameraFullScreen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  cameraOverlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraOverlayMiddle: {
    flexDirection: 'row',
    height: FRAME_HEIGHT,
  },
  cameraOverlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraOverlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraFrame: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#06B6D4',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#06B6D4',
    opacity: 0.8,
  },
  cameraTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cameraTopButton: {
    padding: 8,
  },
  cameraTopTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
  },
  // Result
  resultCard: {
    gap: 16,
    marginBottom: 16,
  },
  verifiedBanner: {
    alignItems: 'center',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  verifiedBadgeText: {
    fontWeight: '600',
    fontSize: 15,
  },
  yesNoBanner: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  yesNoIcon: {
    marginBottom: 4,
  },
  yesNoTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  yesNoReason: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  transactionId: {
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 16,
  },
});
