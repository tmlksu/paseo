import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  Text,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { StyleSheet, withUnistyles } from "react-native-unistyles";
import { Eye, EyeOff, ShieldCheck } from "lucide-react-native";
import { normalizeHostPort } from "@/utils/daemon-endpoints";
import type { HostProfile } from "@/types/host-connection";
import { useHostMutations, useHosts } from "@/runtime/host-runtime";
import { buildCloudflareAccessHeaders } from "@/utils/cloudflare-access";
import { Button } from "@/components/ui/button";
import { Field, FormTextInput } from "@/components/ui/form-field";
import { Switch } from "@/components/ui/switch";
import {
  CONTROL_HEIGHTS,
  createControlGeometry,
  resolveControlInteractionStyles,
} from "@/components/ui/control-geometry";
import type { EditingTextInputHandle } from "@/components/ui/text-input";
import { useIsCompactFormFactor } from "@/constants/layout";
import { DaemonConnectionTestError } from "@/utils/test-daemon-connection";
import { AdaptiveModalSheet, type SheetHeader } from "./adaptive-modal-sheet";

const FLEX_ONE_STYLE = { flex: 1 } as const;
const ThemedShieldCheck = withUnistyles(ShieldCheck);
const ThemedEye = withUnistyles(Eye, (theme) => ({ color: theme.colors.foregroundMuted }));
const ThemedEyeOff = withUnistyles(EyeOff, (theme) => ({ color: theme.colors.foregroundMuted }));

const styles = StyleSheet.create((theme) => {
  const geometry = createControlGeometry(theme);
  return {
    helper: {
      color: theme.colors.foregroundMuted,
      fontSize: theme.fontSize.sm,
    },
    row: {
      flexDirection: "row",
      gap: theme.spacing[3],
    },
    hostField: {
      flex: 1,
      minWidth: 0,
    },
    portField: {
      width: 112,
    },
    secretRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "stretch",
      width: "100%",
      gap: theme.spacing[2],
    },
    secretInputWrap: {
      flex: 1,
      minWidth: 0,
    },
    iconButtonSm: {
      minHeight: CONTROL_HEIGHTS.compact,
      width: CONTROL_HEIGHTS.compact,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface2,
    },
    iconButtonMd: {
      minHeight: CONTROL_HEIGHTS.field,
      width: CONTROL_HEIGHTS.field,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface2,
    },
    controlRest: {
      ...geometry.controlRest,
    },
    controlHover: {
      ...geometry.controlHover,
    },
    controlActive: {
      ...geometry.controlActive,
    },
    controlDisabled: {
      ...geometry.controlDisabled,
    },
    tlsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing[3],
    },
    tlsLabel: {
      color: theme.colors.foreground,
      fontSize: theme.fontSize.base,
    },
    actions: {
      flexDirection: "row",
      gap: theme.spacing[3],
      marginTop: theme.spacing[2],
    },
  };
});

function isIpv6Host(host: string): boolean {
  return host.includes(":") && !host.startsWith("[") && !host.endsWith("]");
}

export interface AddCloudflareAccessHostModalProps {
  visible: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onSaved?: (result: {
    profile: HostProfile;
    serverId: string;
    hostname: string | null;
    isNewHost: boolean;
  }) => void;
}

export function AddCloudflareAccessHostModal({
  visible,
  onClose,
  onCancel,
  onSaved,
}: AddCloudflareAccessHostModalProps) {
  const { t } = useTranslation();
  const hosts = useHosts();
  const isCompact = useIsCompactFormFactor();
  const { probeAndUpsertDirectConnection } = useHostMutations();
  const hostRef = useRef("");
  const portRef = useRef("443");
  const clientIdRef = useRef("");
  const clientSecretRef = useRef("");
  const passwordRef = useRef("");
  const hostInputRef = useRef<EditingTextInputHandle>(null);
  const portInputRef = useRef<EditingTextInputHandle>(null);
  const clientIdInputRef = useRef<EditingTextInputHandle>(null);
  const clientSecretInputRef = useRef<EditingTextInputHandle>(null);
  const passwordInputRef = useRef<EditingTextInputHandle>(null);
  const [useTls, setUseTls] = useState(true);
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const header = useMemo<SheetHeader>(() => ({ title: t("pairing.cloudflareAccess.title") }), [t]);

  const clear = useCallback(() => {
    hostRef.current = "";
    portRef.current = "443";
    clientIdRef.current = "";
    clientSecretRef.current = "";
    passwordRef.current = "";
    hostInputRef.current?.replaceText("");
    portInputRef.current?.replaceText("443");
    clientIdInputRef.current?.replaceText("");
    clientSecretInputRef.current?.replaceText("");
    passwordInputRef.current?.replaceText("");
    setUseTls(true);
    setIsSecretVisible(false);
    setIsPasswordVisible(false);
    setErrorMessage("");
  }, []);

  const handleClose = useCallback(() => {
    if (isSaving) return;
    clear();
    onClose();
  }, [clear, isSaving, onClose]);

  const handleCancel = useCallback(() => {
    if (isSaving) return;
    clear();
    (onCancel ?? onClose)();
  }, [clear, isSaving, onCancel, onClose]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    const host = hostRef.current.trim();
    if (!host) {
      setErrorMessage(t("pairing.cloudflareAccess.errors.hostRequired"));
      return;
    }
    const port = Number(portRef.current.trim());
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setErrorMessage(t("pairing.cloudflareAccess.errors.invalidPort"));
      return;
    }

    let headers: Record<string, string>;
    try {
      headers = buildCloudflareAccessHeaders({
        clientId: clientIdRef.current,
        clientSecret: clientSecretRef.current,
      });
    } catch {
      setErrorMessage(t("pairing.cloudflareAccess.errors.credentialsRequired"));
      return;
    }

    let endpoint: string;
    try {
      const authority = isIpv6Host(host) ? `[${host}]:${port}` : `${host}:${port}`;
      endpoint = normalizeHostPort(authority);
    } catch {
      setErrorMessage(t("pairing.cloudflareAccess.errors.hostRequired"));
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      const result = await probeAndUpsertDirectConnection({
        endpoint,
        useTls,
        password: passwordRef.current === "" ? undefined : passwordRef.current,
        headers,
      });
      clear();
      onClose();
      onSaved?.({
        ...result,
        isNewHost: !hosts.some((profile) => profile.serverId === result.serverId),
      });
    } catch (error) {
      const message =
        error instanceof DaemonConnectionTestError
          ? t("pairing.cloudflareAccess.errors.failedToConnect", { detail: error.message })
          : t("common.errors.unableToSave");
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }, [clear, hosts, isSaving, onClose, onSaved, probeAndUpsertDirectConnection, t, useTls]);

  const handleHostChange = useCallback((value: string) => {
    hostRef.current = value;
  }, []);
  const handlePortChange = useCallback((value: string) => {
    portRef.current = value;
  }, []);
  const handleClientIdChange = useCallback((value: string) => {
    clientIdRef.current = value;
  }, []);
  const handleClientSecretChange = useCallback((value: string) => {
    clientSecretRef.current = value;
  }, []);
  const handlePasswordChange = useCallback((value: string) => {
    passwordRef.current = value;
  }, []);
  const handleToggleSecretVisibility = useCallback(() => {
    setIsSecretVisible((currentlyVisible) => !currentlyVisible);
  }, []);
  const handleTogglePasswordVisibility = useCallback(() => {
    setIsPasswordVisible((currentlyVisible) => !currentlyVisible);
  }, []);
  const iconButtonStyle = useCallback(
    (
      state: PressableStateCallbackType & { hovered?: boolean; focused?: boolean },
    ): StyleProp<ViewStyle> => [
      isCompact ? styles.iconButtonMd : styles.iconButtonSm,
      resolveControlInteractionStyles(
        {
          controlRest: styles.controlRest,
          controlHover: styles.controlHover,
          controlActive: styles.controlActive,
          controlDisabled: styles.controlDisabled,
        },
        {
          hovered: state.hovered,
          pressed: state.pressed,
          focused: state.focused,
          disabled: isSaving,
        },
      ),
    ],
    [isCompact, isSaving],
  );
  const handleSubmit = useCallback(() => void handleSave(), [handleSave]);

  return (
    <AdaptiveModalSheet
      header={header}
      visible={visible}
      onClose={handleClose}
      testID="add-cloudflare-access-host-modal"
    >
      <Text style={styles.helper}>{t("pairing.cloudflareAccess.helper")}</Text>
      <View style={styles.row}>
        <View style={styles.hostField}>
          <Field
            label={t("pairing.cloudflareAccess.fields.host")}
            error={errorMessage}
            testID="cf-access-host"
          >
            <FormTextInput
              ref={hostInputRef}
              size={isCompact ? "md" : "sm"}
              testID="cf-access-host-input"
              accessibilityLabel={t("pairing.cloudflareAccess.fields.host")}
              initialValue=""
              onChangeText={handleHostChange}
              placeholder="daemon.example.com"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSaving}
              returnKeyType="next"
            />
          </Field>
        </View>
        <View style={styles.portField}>
          <Field label={t("pairing.cloudflareAccess.fields.port")} testID="cf-access-port">
            <FormTextInput
              ref={portInputRef}
              size={isCompact ? "md" : "sm"}
              testID="cf-access-port-input"
              accessibilityLabel={t("pairing.cloudflareAccess.fields.port")}
              initialValue="443"
              onChangeText={handlePortChange}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numeric"
              editable={!isSaving}
              returnKeyType="next"
            />
          </Field>
        </View>
      </View>
      <Field label={t("pairing.cloudflareAccess.fields.clientId")} testID="cf-access-client-id">
        <FormTextInput
          ref={clientIdInputRef}
          size={isCompact ? "md" : "sm"}
          testID="cf-access-client-id-input"
          accessibilityLabel={t("pairing.cloudflareAccess.fields.clientId")}
          initialValue=""
          onChangeText={handleClientIdChange}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSaving}
          returnKeyType="next"
        />
      </Field>
      <Field
        label={t("pairing.cloudflareAccess.fields.clientSecret")}
        testID="cf-access-client-secret"
      >
        <View style={styles.secretRow}>
          <View style={styles.secretInputWrap}>
            <FormTextInput
              ref={clientSecretInputRef}
              size={isCompact ? "md" : "sm"}
              testID="cf-access-client-secret-input"
              accessibilityLabel={t("pairing.cloudflareAccess.fields.clientSecret")}
              initialValue=""
              onChangeText={handleClientSecretChange}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!isSecretVisible}
              editable={!isSaving}
              returnKeyType="next"
            />
          </View>
          <Pressable
            style={iconButtonStyle}
            onPress={handleToggleSecretVisibility}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={
              isSecretVisible
                ? t("pairing.cloudflareAccess.passwordVisibility.hide")
                : t("pairing.cloudflareAccess.passwordVisibility.show")
            }
            testID="cf-access-secret-visibility-toggle"
          >
            {isSecretVisible ? <ThemedEyeOff size={18} /> : <ThemedEye size={18} />}
          </Pressable>
        </View>
      </Field>
      <Field label={t("pairing.cloudflareAccess.fields.password")} testID="cf-access-password">
        <View style={styles.secretRow}>
          <View style={styles.secretInputWrap}>
            <FormTextInput
              ref={passwordInputRef}
              size={isCompact ? "md" : "sm"}
              testID="cf-access-password-input"
              accessibilityLabel={t("pairing.cloudflareAccess.fields.password")}
              initialValue=""
              onChangeText={handlePasswordChange}
              placeholder={t("pairing.cloudflareAccess.fields.optional")}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!isPasswordVisible}
              editable={!isSaving}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
          <Pressable
            style={iconButtonStyle}
            onPress={handleTogglePasswordVisibility}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={
              isPasswordVisible
                ? t("pairing.cloudflareAccess.passwordVisibility.hide")
                : t("pairing.cloudflareAccess.passwordVisibility.show")
            }
            testID="cf-access-password-visibility-toggle"
          >
            {isPasswordVisible ? <ThemedEyeOff size={18} /> : <ThemedEye size={18} />}
          </Pressable>
        </View>
      </Field>
      <View style={styles.tlsRow}>
        <Text style={styles.tlsLabel}>{t("pairing.cloudflareAccess.fields.useSsl")}</Text>
        <Switch
          value={useTls}
          onValueChange={setUseTls}
          disabled={isSaving}
          accessibilityLabel={t("pairing.cloudflareAccess.fields.useSsl")}
          testID="cf-access-use-ssl"
        />
      </View>
      <View style={styles.actions}>
        <Button
          style={FLEX_ONE_STYLE}
          variant="secondary"
          onPress={handleCancel}
          disabled={isSaving}
        >
          {t("pairing.cloudflareAccess.actions.cancel")}
        </Button>
        <Button
          style={FLEX_ONE_STYLE}
          onPress={handleSubmit}
          disabled={isSaving}
          leftIcon={ThemedShieldCheck}
          testID="cf-access-submit"
        >
          {isSaving
            ? t("pairing.cloudflareAccess.actions.connecting")
            : t("pairing.cloudflareAccess.actions.connect")}
        </Button>
      </View>
    </AdaptiveModalSheet>
  );
}
