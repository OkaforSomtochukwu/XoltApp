import {
  getMessages,
  sendMessage,
  subscribeToMessages,
  type MessageRow,
  type XoltSupabaseClient,
} from "@xolt/shared";
import { tokens } from "@xolt/ui-tokens";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "./Button";
import { Input } from "./Input";

const { colors, spacing, radius } = tokens;

export type ChatViewProps = {
  /** The app's own typed Supabase client — this component has no client of its own. */
  client: XoltSupabaseClient;
  requestId: string;
  currentUserId: string;
  /** Chat is read-only once the request is no longer in_progress — RLS enforces this either way. */
  canSend: boolean;
};

/**
 * Live chat thread for one consultation request — fetches history once,
 * then stays current via Realtime. Shared by both apps: same data, same
 * rendering, same send-disabled-after-completed behavior.
 */
export function ChatView({ client, requestId, currentUserId, canSend }: ChatViewProps) {
  const [messages, setMessages] = useState<MessageRow[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<MessageRow>>(null);

  useEffect(() => {
    let cancelled = false;

    getMessages(client, requestId)
      .then((rows) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load chat.");
      });

    const unsubscribe = subscribeToMessages(client, requestId, (payload) => {
      const row = payload.new as MessageRow;
      setMessages((prev) => (prev ? [...prev, row] : [row]));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [client, requestId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(client, requestId, body);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that message.");
    } finally {
      setSending(false);
    }
  }

  if (error && messages === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (messages === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const mine = item.sender_id === currentUserId;
          return (
            <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />
      {canSend ? (
        <View style={styles.composer}>
          <View style={styles.composerInput}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder="Message"
              multiline
              editable={!sending}
            />
          </View>
          <Button variant="primary" onPress={handleSend} disabled={sending || draft.trim().length === 0}>
            Send
          </Button>
        </View>
      ) : (
        <Text style={styles.closedNotice}>This consultation has ended — chat is read-only.</Text>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    gap: 8,
    paddingVertical: spacing[3],
  },
  bubbleRow: {
    flexDirection: "row",
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
  },
  bubbleMine: {
    backgroundColor: colors.accent.base,
  },
  bubbleText: {
    fontSize: 14,
    color: colors.text,
  },
  bubbleTextMine: {
    color: colors.bg,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingVertical: spacing[2],
  },
  composerInput: {
    flex: 1,
  },
  closedNotice: {
    fontSize: 12,
    opacity: 0.6,
    color: colors.text,
    paddingVertical: spacing[2],
  },
  errorText: {
    fontSize: 12,
    color: colors.accent.base,
  },
});
