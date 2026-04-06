import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test';

type MeetingStatus = 'created' | 'recording' | 'paused' | 'ended' | 'ended_abnormal';

interface MockMeetingState {
  host: {
    id: string;
    email: string;
    display_name: string;
  };
  tokens: {
    access_token: string;
    refresh_token: string;
    token_type: 'bearer';
    expires_in: number;
  };
  meeting: {
    id: string;
    room_code: string;
    title: string;
    source_language: string;
    status: MeetingStatus;
    created_at: string;
    started_at: string | null;
    ended_at: string | null;
    join_url: string;
    has_summary: boolean;
    has_transcript: boolean;
    available_translations: string[];
    duration_seconds?: number;
  } | null;
  transcript: Array<{
    id: string;
    sequence: number;
    text: string;
    start_time_ms: number;
    end_time_ms: number;
    is_partial: boolean;
    confidence: number;
    translations?: Array<{ target_language: string; translated_text: string }>;
  }>;
  summary: {
    id: string;
    content: string;
    key_points: string[];
    decisions: Array<{ decision: string; context: string }>;
    action_items: Array<{ task: string; assignee: string | null; deadline: string | null }>;
    created_at: string;
  } | null;
}

const nowIso = new Date('2026-04-06T12:00:00.000Z').toISOString();

const createState = (): MockMeetingState => ({
  host: {
    id: 'host-1',
    email: 'test@example.com',
    display_name: 'Test Host',
  },
  tokens: {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
  },
  meeting: null,
  transcript: [],
  summary: null,
});

const installMockWebSocket = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(() => {
    class MockWebSocket {
      static instances: MockWebSocket[] = [];
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      readyState = MockWebSocket.CONNECTING;
      onopen: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      readonly url: string;

      constructor(url: string) {
        this.url = url;
        MockWebSocket.instances.push(this);
        window.setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.onopen?.(new Event('open'));

          const role = url.includes('/participant') ? 'participant' : 'host';
          const meetingId = url.match(/meeting\/([^/]+)/)?.[1] ?? 'meeting-1';
          const payload = {
            type: 'connected',
            payload: {
              session_id: `${role}-session`,
              role,
              meeting: {
                id: meetingId,
                title: 'Team Sync',
                source_language: 'vi',
                status: 'recording',
                started_at: new Date('2026-04-06T12:00:00.000Z').toISOString(),
              },
              participant_count: role === 'participant' ? 2 : 1,
            },
          };
          this.onmessage?.(
            new MessageEvent('message', { data: JSON.stringify(payload) }),
          );

          if (role === 'participant') {
            this.onmessage?.(
              new MessageEvent('message', {
                data: JSON.stringify({
                  type: 'participant_joined',
                  payload: { participant_count: 2 },
                }),
              }),
            );
          }
        }, 0);
      }

      send(_data: string): void {}

      close(): void {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.(new CloseEvent('close'));
      }

      addEventListener(type: string, listener: EventListener): void {
        if (type === 'open') this.onopen = listener as (event: Event) => void;
        if (type === 'message') this.onmessage = listener as (event: MessageEvent<string>) => void;
        if (type === 'close') this.onclose = listener as (event: CloseEvent) => void;
        if (type === 'error') this.onerror = listener as (event: Event) => void;
      }

      removeEventListener(): void {}
    }

    Object.assign(MockWebSocket, {
      emit(index: number, payload: unknown) {
        const instance = MockWebSocket.instances[index];
        instance?.onmessage?.(
          new MessageEvent('message', { data: JSON.stringify(payload) }),
        );
      },
    });

    Object.defineProperty(window, '__mockSockets', {
      value: MockWebSocket,
      configurable: true,
    });
    Object.defineProperty(window, 'WebSocket', {
      value: MockWebSocket,
      configurable: true,
      writable: true,
    });
  });
};

const installApiMocks = async (context: BrowserContext, state: MockMeetingState): Promise<void> => {
  await context.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const { pathname, searchParams } = url;
    const method = route.request().method();

    if (pathname.endsWith('/auth/register') && method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ...state.host, created_at: nowIso }),
      });
      return;
    }

    if (pathname.endsWith('/auth/login') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.tokens),
      });
      return;
    }

    if (pathname.endsWith('/hosts/me') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...state.host, created_at: nowIso }),
      });
      return;
    }

    if (pathname.endsWith('/meetings') && method === 'GET') {
      const meetings = state.meeting ? [state.meeting] : [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ meetings, total: meetings.length, limit: 5, offset: 0 }),
      });
      return;
    }

    if (pathname.endsWith('/meetings') && method === 'POST') {
      state.meeting = {
        id: 'meeting-1',
        room_code: 'ROOM01',
        title: 'Team Sync',
        source_language: 'vi',
        status: 'recording',
        created_at: nowIso,
        started_at: nowIso,
        ended_at: null,
        join_url: 'http://127.0.0.1:4173/join/ROOM01',
        has_summary: false,
        has_transcript: false,
        available_translations: [],
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(state.meeting),
      });
      return;
    }

    if (pathname.endsWith('/meetings/meeting-1') && method === 'GET' && state.meeting) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.meeting),
      });
      return;
    }

    if (pathname.endsWith('/meetings/join/ROOM01') && method === 'GET' && state.meeting) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          meeting_id: state.meeting.id,
          title: state.meeting.title,
          source_language: state.meeting.source_language,
          status: state.meeting.status,
          started_at: state.meeting.started_at,
          websocket_url: 'ws://127.0.0.1:4173/ws/meeting/meeting-1/participant?room_code=ROOM01',
          has_transcript: state.meeting.has_transcript,
          has_summary: state.meeting.has_summary,
          available_translations: state.meeting.available_translations,
        }),
      });
      return;
    }

    if (pathname.endsWith('/meetings/meeting-1/transcript') && method === 'GET') {
      const includeTranslations = searchParams.get('include_translations');
      const segments = state.transcript.map((segment) => ({
        ...segment,
        translations: includeTranslations
          ? segment.translations?.filter((item) => item.target_language === includeTranslations) ?? []
          : segment.translations ?? [],
      }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          meeting_id: 'meeting-1',
          source_language: 'vi',
          segments,
          total_segments: segments.length,
          limit: 100,
          offset: 0,
        }),
      });
      return;
    }

    if (pathname.endsWith('/meetings/join/ROOM01/transcript') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          meeting_id: 'meeting-1',
          source_language: 'vi',
          segments: state.transcript,
          total_segments: state.transcript.length,
          limit: 100,
          offset: 0,
        }),
      });
      return;
    }

    if (pathname.endsWith('/meetings/meeting-1/summary') && method === 'GET' && state.summary) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.summary),
      });
      return;
    }

    if (pathname.endsWith('/meetings/join/ROOM01/summary') && method === 'GET' && state.summary) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.summary),
      });
      return;
    }

    if (pathname.endsWith('/meetings/meeting-1/summary') && method === 'POST') {
      state.summary = {
        id: 'summary-1',
        content: 'Decisions: Ship beta. Action items: Prepare launch notes.',
        key_points: ['Reviewed beta scope'],
        decisions: [{ decision: 'Ship beta', context: 'After participant review' }],
        action_items: [{ task: 'Prepare launch notes', assignee: 'Test Host', deadline: null }],
        created_at: nowIso,
      };
      state.meeting = state.meeting
        ? { ...state.meeting, has_summary: true }
        : state.meeting;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.summary),
      });
      return;
    }

    if (pathname.endsWith('/meetings/join/ROOM01/summary') && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state.summary),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
};

const emitSocketMessage = async (page: Page, payload: unknown, index = 0): Promise<void> => {
  await page.evaluate(
    ([messageIndex, nextPayload]) => {
      const sockets = (window as typeof window & { __mockSockets: { emit: (i: number, payload: unknown) => void } }).__mockSockets;
      sockets.emit(messageIndex, nextPayload);
    },
    [index, payload] as const,
  );
};

test('host to participant replay flow', async ({ browser }) => {
  const state = createState();
  const hostContext = await browser.newContext();
  const participantContext = await browser.newContext();

  await installMockWebSocket(hostContext);
  await installMockWebSocket(participantContext);
  await installApiMocks(hostContext, state);
  await installApiMocks(participantContext, state);

  const hostPage = await hostContext.newPage();

  await hostPage.goto('/register');
  await hostPage.getByLabel('Display name').fill('Test Host');
  await hostPage.getByLabel('Email').fill('test@example.com');
  await hostPage.getByLabel('Password').nth(0).fill('Test1234');
  await hostPage.getByLabel('Confirm password').fill('Test1234');
  await hostPage.getByRole('button', { name: 'Create account' }).click();

  await expect(hostPage).toHaveURL('/');
  await hostPage.getByLabel('Meeting title').fill('Team Sync');
  await hostPage.getByRole('button', { name: 'Create meeting' }).click();
  await expect(hostPage).toHaveURL('/meeting/meeting-1');
  await expect(hostPage.getByText('Team Sync')).toBeVisible();

  const participantPage = await participantContext.newPage();
  await participantPage.goto('/join/ROOM01');
  await expect(participantPage.getByText('Team Sync')).toBeVisible();

  state.transcript = [
    {
      id: 'segment-1',
      sequence: 1,
      text: 'Xin chào mọi người',
      start_time_ms: 0,
      end_time_ms: 1500,
      is_partial: false,
      confidence: 0.96,
      translations: [{ target_language: 'en', translated_text: 'Hello everyone' }],
    },
  ];
  state.meeting = state.meeting
    ? { ...state.meeting, has_transcript: true, available_translations: ['en'] }
    : state.meeting;

  await emitSocketMessage(hostPage, {
    type: 'transcript_segment',
    payload: state.transcript[0],
  });
  await emitSocketMessage(participantPage, {
    type: 'transcript_segment',
    payload: state.transcript[0],
  });

  await expect(hostPage.getByText('Xin chào mọi người')).toBeVisible();
  await expect(participantPage.getByText('Xin chào mọi người')).toBeVisible();

  state.summary = {
    id: 'summary-1',
    content: 'Decisions: Ship beta. Action items: Prepare launch notes.',
    key_points: ['Reviewed beta scope'],
    decisions: [{ decision: 'Ship beta', context: 'After participant review' }],
    action_items: [{ task: 'Prepare launch notes', assignee: 'Test Host', deadline: null }],
    created_at: nowIso,
  };
  state.meeting = state.meeting
    ? {
        ...state.meeting,
        status: 'ended',
        ended_at: nowIso,
        duration_seconds: 90,
        has_summary: true,
      }
    : state.meeting;

  await hostPage.goto('/meeting/meeting-1/replay');
  await expect(hostPage.getByText('Xin chào mọi người')).toBeVisible();
  await expect(hostPage.getByText('Decisions: Ship beta. Action items: Prepare launch notes.')).toBeVisible();

  await hostContext.close();
  await participantContext.close();
});
