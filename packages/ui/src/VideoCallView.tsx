import {
  CallContent,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
} from "@stream-io/video-react-native-sdk";
import { tokens } from "@xolt/ui-tokens";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const { colors } = tokens;

export type VideoCallTokenResult = {
  token: string;
  apiKey: string;
  userId: string;
  callId: string;
};

export type VideoCallViewProps = {
  /** Fetches a fresh Stream token from the video-token Edge Function — apps supply this since they own their own Supabase client/fetch setup. */
  getToken: () => Promise<VideoCallTokenResult>;
  onLeave: () => void;
};

/**
 * A single consultation call using Stream's prebuilt CallContent UI —
 * shared by both apps. Call id is the consultation request id (one call
 * per request), joined with create:true so whichever party arrives first
 * starts it.
 */
export function VideoCallView({ getToken, onLeave }: VideoCallViewProps) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<ReturnType<StreamVideoClient["call"]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdClient: StreamVideoClient | null = null;

    getToken()
      .then(async ({ token, apiKey, userId, callId }) => {
        const videoClient = StreamVideoClient.getOrCreateInstance({
          apiKey,
          user: { id: userId },
          token,
        });
        createdClient = videoClient;
        const videoCall = videoClient.call("default", callId);
        await videoCall.join({ create: true });
        if (cancelled) {
          await videoCall.leave().catch(() => {});
          return;
        }
        setClient(videoClient);
        setCall(videoCall);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not start the call.");
      });

    return () => {
      cancelled = true;
      createdClient?.disconnectUser().catch(() => {});
    };
  }, [getToken]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!client || !call) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallContent onHangupCallHandler={onLeave} />
      </StreamCall>
    </StreamVideo>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 13,
    color: colors.accent.base,
    textAlign: "center",
    padding: 16,
  },
});
