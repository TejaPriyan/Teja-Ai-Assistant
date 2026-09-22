/**
 * Computer Control Service
 * Provides mouse, keyboard, and screen control via the system bridge API.
 */

export class ComputerControlService {
  // =============================================
  // MOUSE CONTROL
  // =============================================

  async mouseClick(x: number, y: number): Promise<{ success: boolean; message: string }> {
    return this.callMouse('click', { x, y });
  }

  async mouseDoubleClick(x: number, y: number): Promise<{ success: boolean; message: string }> {
    return this.callMouse('doubleclick', { x, y });
  }

  async mouseRightClick(x: number, y: number): Promise<{ success: boolean; message: string }> {
    return this.callMouse('rightclick', { x, y });
  }

  async mouseMove(x: number, y: number): Promise<{ success: boolean; message: string }> {
    return this.callMouse('move', { x, y });
  }

  async mouseScroll(direction: 'up' | 'down', clicks = 3): Promise<{ success: boolean; message: string }> {
    const scrollClicks = direction === 'up' ? clicks : -clicks;
    return this.callMouse('scroll', { clicks: scrollClicks });
  }

  async mouseDrag(x1: number, y1: number, x2: number, y2: number): Promise<{ success: boolean; message: string }> {
    return this.callMouse('drag', { x: x1, y: y1, x2, y2 });
  }

  // =============================================
  // KEYBOARD CONTROL
  // =============================================

  async typeText(text: string): Promise<{ success: boolean; message: string }> {
    return this.callKeyboard('type', { text });
  }

  async pressKey(key: string): Promise<{ success: boolean; message: string }> {
    return this.callKeyboard('key', { key });
  }

  async hotKey(combo: string): Promise<{ success: boolean; message: string }> {
    return this.callKeyboard('hotkey', { combo });
  }

  // =============================================
  // COMPOUND ACTIONS
  // =============================================

  /** Click at coordinates, then type text */
  async clickAndType(x: number, y: number, text: string): Promise<{ success: boolean; message: string }> {
    const clickResult = await this.mouseClick(x, y);
    if (!clickResult.success) return clickResult;
    await this.delay(300);
    return this.typeText(text);
  }

  /** Click at coordinates, type text, then press Enter */
  async clickTypeEnter(x: number, y: number, text: string): Promise<{ success: boolean; message: string }> {
    const clickResult = await this.mouseClick(x, y);
    if (!clickResult.success) return clickResult;
    await this.delay(300);
    const typeResult = await this.typeText(text);
    if (!typeResult.success) return typeResult;
    await this.delay(200);
    return this.pressKey('enter');
  }

  // =============================================
  // INTERNAL API CALLS
  // =============================================

  private async callMouse(
    action: string,
    params: { x?: number; y?: number; x2?: number; y2?: number; clicks?: number }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/system/mouse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      });
      if (res.ok) {
        const data = await res.json();
        return { success: data.success ?? true, message: data.message || `Mouse ${action} completed` };
      }
      return { success: false, message: `Mouse ${action} failed (${res.status})` };
    } catch (err: any) {
      return { success: false, message: `Mouse ${action} error: ${err?.message || 'unknown'}` };
    }
  }

  private async callKeyboard(
    action: string,
    params: { text?: string; key?: string; combo?: string }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/system/keyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      });
      if (res.ok) {
        const data = await res.json();
        return { success: data.success ?? true, message: data.message || `Keyboard ${action} completed` };
      }
      return { success: false, message: `Keyboard ${action} failed (${res.status})` };
    } catch (err: any) {
      return { success: false, message: `Keyboard ${action} error: ${err?.message || 'unknown'}` };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const computerControl = new ComputerControlService();
