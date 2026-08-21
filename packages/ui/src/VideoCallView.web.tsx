import { tokens } from "@xolt/ui-tokens";
import { StyleSheet, Text, View } from "react-native";

const { colors } = tokens;

// Web platform variant — deliberately does NOT import
// @stream-io/video-react-native-sdk. That package has no browser-safe
// entry point (no `browser` field, no .web.js file overrides for the
// pieces that call requireNativeComponent), so importing it anywhere in
// this file's module graph crashes any web-platform bundle that touches
// it — including, non-obviously, Expo Router's web dev server's SSR
// route-tree validation pass, which eagerly evaluates every route file's
// imports and therefore every barrel export of @xolt/ui, regardless of
// whether that specific route uses VideoCallView. Metro picks this file
// over VideoCallView.tsx for any platform=web bundle automatically, same
// convention as animated-icon.web.tsx / use-color-scheme.web.ts elsewhere
// in this codebase — real calling only ever runs on native builds anyway
// (see VideoCallView.tsx and the app.json native config it requires).
export type VideoCallTokenResult = {
  token: string;
  apiKey: string;
  userId: string;
  callId: string;
};

export type VideoCallViewProps = {
  getToken: () => Promise<VideoCallTokenResult>;
  onLeave: () => void;
};

export function VideoCallView(_props: VideoCallViewProps) {
  return (
    <View style={styles.centered}>
      <Text style={styles.text}>
        Video calls aren't available in the web preview — open this app on your phone to start a
        call.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  text: {
    fontSize: 14,
    textAlign: "center",
    color: colors.text,
    opacity: 0.7,
  },
});
