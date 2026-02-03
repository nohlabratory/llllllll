
import { TelegramUpdate } from '../types';

export class TelegramBotService {
  private token: string;
  private offset: number = 0;

  constructor(token: string) {
    this.token = token;
  }

  private async fetchApi(method: string, body: any = {}) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      return await response.json();
    } catch (error) {
      console.error(`Telegram API Error (${method}):`, error);
      throw error;
    }
  }

  async getMe() {
    return this.fetchApi('getMe');
  }

  async getUpdates(): Promise<TelegramUpdate[]> {
    const data = await this.fetchApi('getUpdates', {
      offset: this.offset,
      timeout: 30,
    });
    
    if (data.ok && data.result.length > 0) {
      this.offset = data.result[data.result.length - 1].update_id + 1;
    }
    
    return data.result || [];
  }

  async sendMessage(chatId: number, text: string, replyMarkup?: any) {
    return this.fetchApi('sendMessage', {
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    });
  }

  async deleteMessage(chatId: number, messageId: number) {
    return this.fetchApi('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text: string) {
    return this.fetchApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: true
    });
  }

  static extractLinks(text: string): { url: string; type: 'public' | 'private' }[] {
    // Regex for Telegram links
    // Public: t.me/username
    // Private: t.me/+hash or t.me/joinchat/hash
    const publicRegex = /(?:https?:\/\/)?(?:t(?:elegram)?\.me|telegram\.dog)\/([a-zA-Z0-9_]{5,32})(?!\/|\+)/gi;
    const privateRegex = /(?:https?:\/\/)?(?:t(?:elegram)?\.me|telegram\.dog)\/(?:\+|joinchat\/)([a-zA-Z0-9_\-]+)/gi;
    
    const links: { url: string; type: 'public' | 'private' }[] = [];
    
    let match;
    while ((match = publicRegex.exec(text)) !== null) {
      links.push({ url: match[0], type: 'public' });
    }
    
    while ((match = privateRegex.exec(text)) !== null) {
      links.push({ url: match[0], type: 'private' });
    }
    
    return links;
  }
}
