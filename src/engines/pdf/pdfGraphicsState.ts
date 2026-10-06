/**
 * PDF Graphics State Interpreter according to ISO 32000-1 (PDF Reference) Section 9.3 & 8.4.
 * Tracks nested graphics state (q/Q), current transformation matrix (CTM),
 * text matrix (Tm), text line matrix (TLM), text state parameters (Tf, Tc, Tw, Tz, TL, Ts, Tr),
 * colors, and alpha.
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export type Matrix2D = [number, number, number, number, number, number];

export function createIdentityMatrix(): Matrix2D {
  return [1, 0, 0, 1, 0, 0];
}

/**
 * Multiplies two 3x3 affine transformation matrices: [a, b, c, d, e, f].
 * [m1] * [m2] in PostScript/PDF order.
 */
export function multiplyMatrices(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;

  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2,
  ];
}

/**
 * Transforms point (x, y) by matrix [a, b, c, d, e, f].
 */
export function transformPoint(m: Matrix2D, x: number, y: number): { x: number; y: number } {
  return {
    x: m[0] * x + m[2] * y + m[4],
    y: m[1] * x + m[3] * y + m[5],
  };
}

export interface PdfGraphicsStateSnapshot {
  ctm: Matrix2D;
  tm: Matrix2D;
  tlm: Matrix2D;
  fontResource: string;
  fontSize: number;
  charSpacing: number; // Tc
  wordSpacing: number; // Tw
  horizontalScale: number; // Tz (percentage, default 100)
  leading: number; // TL
  rise: number; // Ts
  renderMode: number; // Tr (0=fill, 1=stroke, etc.)
  fillColor: RgbColor;
  strokeColor: RgbColor;
  fillAlpha: number;
  strokeAlpha: number;
}

export class PdfGraphicsState {
  public ctm: Matrix2D = createIdentityMatrix();
  public tm: Matrix2D = createIdentityMatrix();
  public tlm: Matrix2D = createIdentityMatrix();
  public fontResource: string = '';
  public fontSize: number = 12;
  public charSpacing: number = 0; // Tc
  public wordSpacing: number = 0; // Tw
  public horizontalScale: number = 100; // Tz
  public leading: number = 12; // TL
  public rise: number = 0; // Ts
  public renderMode: number = 0; // Tr
  public fillColor: RgbColor = { r: 0, g: 0, b: 0 };
  public strokeColor: RgbColor = { r: 0, g: 0, b: 0 };
  public fillAlpha: number = 1.0;
  public strokeAlpha: number = 1.0;

  private stack: PdfGraphicsStateSnapshot[] = [];

  /**
   * Creates a deep snapshot copy of the current state.
   */
  public snapshot(): PdfGraphicsStateSnapshot {
    return {
      ctm: [...this.ctm] as Matrix2D,
      tm: [...this.tm] as Matrix2D,
      tlm: [...this.tlm] as Matrix2D,
      fontResource: this.fontResource,
      fontSize: this.fontSize,
      charSpacing: this.charSpacing,
      wordSpacing: this.wordSpacing,
      horizontalScale: this.horizontalScale,
      leading: this.leading,
      rise: this.rise,
      renderMode: this.renderMode,
      fillColor: { ...this.fillColor },
      strokeColor: { ...this.strokeColor },
      fillAlpha: this.fillAlpha,
      strokeAlpha: this.strokeAlpha,
    };
  }

  /**
   * q: Save graphics state to stack.
   */
  public save(): void {
    this.stack.push(this.snapshot());
  }

  /**
   * Q: Restore graphics state from stack.
   */
  public restore(): void {
    if (this.stack.length > 0) {
      const popped = this.stack.pop()!;
      this.ctm = [...popped.ctm] as Matrix2D;
      this.tm = [...popped.tm] as Matrix2D;
      this.tlm = [...popped.tlm] as Matrix2D;
      this.fontResource = popped.fontResource;
      this.fontSize = popped.fontSize;
      this.charSpacing = popped.charSpacing;
      this.wordSpacing = popped.wordSpacing;
      this.horizontalScale = popped.horizontalScale;
      this.leading = popped.leading;
      this.rise = popped.rise;
      this.renderMode = popped.renderMode;
      this.fillColor = { ...popped.fillColor };
      this.strokeColor = { ...popped.strokeColor };
      this.fillAlpha = popped.fillAlpha;
      this.strokeAlpha = popped.strokeAlpha;
    }
  }

  /**
   * cm: Concatenate matrix to current transformation matrix (CTM).
   */
  public concatenateCTM(m: Matrix2D): void {
    this.ctm = multiplyMatrices(m, this.ctm);
  }

  /**
   * BT: Begin text object. Resets Tm and TLM to identity.
   */
  public beginText(): void {
    this.tm = createIdentityMatrix();
    this.tlm = createIdentityMatrix();
  }

  /**
   * ET: End text object.
   */
  public endText(): void {
    this.tm = createIdentityMatrix();
    this.tlm = createIdentityMatrix();
  }

  /**
   * Tm: Set text matrix and line matrix.
   */
  public setTextMatrix(m: Matrix2D): void {
    this.tm = [...m] as Matrix2D;
    this.tlm = [...m] as Matrix2D;
  }

  /**
   * Td: Move text position by (tx, ty).
   */
  public moveTextPosition(tx: number, ty: number): void {
    const shiftMatrix: Matrix2D = [1, 0, 0, 1, tx, ty];
    this.tlm = multiplyMatrices(shiftMatrix, this.tlm);
    this.tm = [...this.tlm] as Matrix2D;
  }

  /**
   * TD: Move text position and set leading (TL = -ty).
   */
  public moveTextPositionWithLeading(tx: number, ty: number): void {
    this.leading = -ty;
    this.moveTextPosition(tx, ty);
  }

  /**
   * T*: Move to start of next line using leading.
   */
  public nextLine(): void {
    this.moveTextPosition(0, -this.leading);
  }

  /**
   * Tf: Set font resource name and size.
   */
  public setFont(resourceName: string, size: number): void {
    this.fontResource = resourceName;
    this.fontSize = size;
  }

  /**
   * Computes the effective text-to-page transformation matrix.
   * Page coordinates = Text Coordinates * Tm * CTM
   */
  public getEffectiveMatrix(): Matrix2D {
    return multiplyMatrices(this.tm, this.ctm);
  }

  /**
   * Computes page baseline coordinates (x, y) for current text position.
   */
  public getCurrentPagePosition(): { x: number; y: number } {
    const eff = this.getEffectiveMatrix();
    return {
      x: eff[4],
      y: eff[5] + this.rise,
    };
  }

  /**
   * Advances text matrix horizontally by displacement (in text space).
   * tx = (glyphWidthInEm * fontSize + charSpacing + (isSpace ? wordSpacing : 0)) * (horizontalScale / 100)
   */
  public advanceText(tx: number, ty: number = 0): void {
    const advanceMatrix: Matrix2D = [1, 0, 0, 1, tx, ty];
    this.tm = multiplyMatrices(advanceMatrix, this.tm);
  }
}
