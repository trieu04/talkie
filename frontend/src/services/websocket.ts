import type {
  WebSocketConnectOptions,
  WebSocketConnectionState,
  WebSocketEnvelope,
} from '@/types';

type MessageHandler = (message: WebSocketEnvelope) => void;
type StateHandler = (state: WebSocketConnectionState) => void;

const MAX_RECONNECT_DELAY_MS = 32000;
const INITIAL_RECONNECT_DELAY_MS = 1000;

const resolveWebSocketBaseUrl = (): string => {
  const configuredBaseUrl = import.meta.env.VITE_WS_BASE_URL;
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/$/, '');
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};

export class WebSocketService {
  private socket: WebSocket | null = null;

  private reconnectTimer: number | null = null;

  private reconnectAttempts = 0;

  private shouldReconnect = true;

  private currentState: WebSocketConnectionState = 'idle';

  private connectOptions: WebSocketConnectOptions | null = null;

  private messageHandlers = new Map<string, Set<MessageHandler>>();

  private stateHandlers = new Set<StateHandler>();

  get state(): WebSocketConnectionState {
    return this.currentState;
  }

  connect(options: WebSocketConnectOptions) {
    this.connectOptions = options;
    this.shouldReconnect = true;

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.disconnect(false);
    }

    this.updateState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    this.socket = new WebSocket(this.buildUrl(options));
    this.bindSocketEvents();
  }

  disconnect(manual = true) {
    this.shouldReconnect = !manual;

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.reconnectAttempts = 0;
    this.updateState('disconnected');
  }

  send<TPayload extends Record<string, unknown>>(type: string, payload: TPayload) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected.');
    }

    this.socket.send(
      JSON.stringify({
        type,
        payload,
      }),
    );
  }

  on(messageType: string, handler: MessageHandler) {
    const existingHandlers = this.messageHandlers.get(messageType) ?? new Set<MessageHandler>();
    existingHandlers.add(handler);
    this.messageHandlers.set(messageType, existingHandlers);

    return () => {
      existingHandlers.delete(handler);
      if (existingHandlers.size === 0) {
        this.messageHandlers.delete(messageType);
      }
    };
  }

  onStateChange(handler: StateHandler) {
    this.stateHandlers.add(handler);

    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  private bindSocketEvents() {
    if (!this.socket) {
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.updateState('connected');
    };

    this.socket.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data) as WebSocketEnvelope;
        this.notifyMessageHandlers(envelope);
      } catch {
        this.updateState('error');
      }
    };

    this.socket.onerror = () => {
      this.updateState('error');
    };

    this.socket.onclose = () => {
      this.socket = null;

      if (this.shouldReconnect && this.connectOptions) {
        this.scheduleReconnect();
        return;
      }

      this.updateState('disconnected');
    };
  }

  private scheduleReconnect() {
    if (!this.connectOptions) {
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts,
      MAX_RECONNECT_DELAY_MS,
    );

    this.reconnectAttempts += 1;
    this.updateState('reconnecting');

    this.reconnectTimer = window.setTimeout(() => {
      this.connect(this.connectOptions as WebSocketConnectOptions);
    }, delay);
  }

  private notifyMessageHandlers(message: WebSocketEnvelope) {
    const exactHandlers = this.messageHandlers.get(message.type);
    exactHandlers?.forEach((handler) => handler(message));

    const wildcardHandlers = this.messageHandlers.get('*');
    wildcardHandlers?.forEach((handler) => handler(message));
  }

  private updateState(state: WebSocketConnectionState) {
    this.currentState = state;
    this.stateHandlers.forEach((handler) => handler(state));
  }

  private buildUrl(options: WebSocketConnectOptions): string {
    const baseUrl = resolveWebSocketBaseUrl();
    const path = `${baseUrl}/meeting/${options.meetingId}/${options.role}`;
    const query = new URLSearchParams();

    if (options.role === 'host') {
      if (!options.accessToken) {
        throw new Error('Host WebSocket connection requires access token.');
      }

      query.set('token', options.accessToken);
    }

    if (options.role === 'participant') {
      if (!options.roomCode) {
        throw new Error('Participant WebSocket connection requires room code.');
      }

      query.set('room_code', options.roomCode);
    }

    return `${path}?${query.toString()}`;
  }
}

export const websocketService = new WebSocketService();
