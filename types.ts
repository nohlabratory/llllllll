
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
    };
    chat: {
      id: number;
    };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
    };
    data: string;
    message?: {
      chat: {
        id: number;
      };
      message_id: number;
    };
  };
}

export interface LinkData {
  url: string;
  type: 'public' | 'private';
  timestamp: number;
}

export enum BotStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  ERROR = 'ERROR',
  STARTING = 'STARTING'
}
