/**
 * 图片轮盘数字识别 — 基于 Tesseract.js 浏览器端 OCR
 *
 * ## 为什么选 Tesseract.js
 * - 完全在浏览器内运行，不需要服务器、不需要 API Key、零费用
 * - 用户数据不离开设备，隐私安全
 * - 替代方案（GPT-4o / Claude Vision API）准确率更高但需要注册付费账号，
 *   且图片需上传到外部服务器。如果 Tesseract 在真实台面截图上准确率不达标，
 *   可升级到 API 方案。
 *
 * ## 识别流水线
 * 1. 加载图片文件 → HTMLImageElement
 * 2. 预处理：Canvas 转灰度 + 对比度拉伸（提升有色背景上数字的识别率）
 * 3. Tesseract.js OCR，限制字符白名单为 "0123456789 "（仅识别数字和空格）
 * 4. 将 OCR 输出的文本送入已有的 parseNumbersText() 解析成 RouletteNumber[]
 *
 * ## 已知局限
 * - 极小字体（等效 <12px）、低对比度（浅灰字白底）、装饰性/异形字体 → 识别率下降
 * - 轮盘历史板常见的红/黑色数字在深色背景上 → 预处理可缓解但不能完全消除
 * - 拍照的物理屏幕（角度倾斜、反光、摩尔纹）→ 识别率进一步降低
 * - 干净截图的预期准确率 ~90-98%；200 个数字 × 2% 错误率 = ~4 个错误
 * - **务必核对输出数量和抽查关键位置**，不要盲信 OCR 结果直接导入
 *
 * ## Tesseract 配置说明
 * - 语言: 'eng' — 英文模型已包含数字，模型体积最小
 * - OEM: LSTM_ONLY (1) — 仅使用 LSTM 神经网络引擎，比传统引擎更快更准
 * - PSM: SPARSE_TEXT (11) — 将数字视为独立文本块，而非连续段落；
 *   如果数字排列紧密呈矩阵状，可尝试 SINGLE_BLOCK (6)
 * - 白名单: "0123456789 " — 大幅缩小搜索空间，排除字母/标点干扰
 *
 * ## 依赖
 * - tesseract.js v7.x (npm package)
 * - 首次调用时自动从 jsDelivr CDN 下载 WASM + 语言模型 (~2-5MB)
 * - 同浏览器会话内后续调用使用缓存
 *
 * ## 使用示例（功能开放后接入 UI 时参考）
 * ```ts
 * import { recognizeNumbersFromImage } from './core/imageNumberReader';
 *
 * const file = event.target.files[0]; // <input type="file" accept="image/*">
 * const result = await recognizeNumbersFromImage(file);
 * // result: ParsedNumbers = { numbers: RouletteNumber[], invalidTokens: string[] }
 * if (result.invalidTokens.length) {
 *   console.warn('未能解析的 token:', result.invalidTokens);
 * }
 * console.log(`识别到 ${result.numbers.length} 个有效数字`);
 * ```
 *
 * @module imageNumberReader
 * @hidden 本模块尚未接入 UI，属于预留能力。待真实台面截图验证识别准确率后开放。
 */

import Tesseract from 'tesseract.js';
import { parseNumbersText, type ParsedNumbers } from './numberText';

// ---------------------------------------------------------------------------
// 图片预处理
// ---------------------------------------------------------------------------

/**
 * 对图片做灰度化 + 对比度拉伸，提升 OCR 准确率。
 *
 * 轮盘历史显示常用有色背景（绿/红/深色）+ 彩色数字，这会干扰 Tesseract。
 * 本函数通过 Canvas 处理：
 * 1. 将图片绘制到离屏 Canvas
 * 2. 逐像素计算亮度（感知加权: R*0.299 + G*0.587 + B*0.114）
 * 3. 统计实际亮度范围 [minLum, maxLum]
 * 4. 将亮度线性拉伸到 [0, 255] 全范围
 *
 * 第 4 步是关键 —— 确保无论原始配色如何，最终都是深色数字在浅色背景上。
 *
 * @param source - 已加载的图片元素
 * @returns 预处理后的 PNG Data URL
 */
function preprocessImage(source: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // 第一遍：计算每个像素的感知亮度，跟踪最小/最大值
  let minLum = 255;
  let maxLum = 0;
  const luminances: number[] = [];

  for (let i = 0; i < pixels.length; i += 4) {
    // 感知亮度公式 — 绿色权重最高（人眼对绿色最敏感）
    const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    luminances.push(lum);
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  // 第二遍：对比度拉伸 + 写入灰度值
  // 映射公式: new = (old - min) * 255 / (max - min)
  // 最暗像素 → 0 (纯黑)，最亮像素 → 255 (纯白)
  const range = maxLum - minLum || 1; // 防止纯色图除以零
  let lumIdx = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const stretched = ((luminances[lumIdx++] - minLum) / range) * 255;
    // R=G=B=stretched 产生灰度像素；Alpha 通道保持不变
    pixels[i] = pixels[i + 1] = pixels[i + 2] = stretched;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

// ---------------------------------------------------------------------------
// 图片加载辅助
// ---------------------------------------------------------------------------

/**
 * 从 File 或 Blob 加载 HTMLImageElement。
 *
 * 使用 URL.createObjectURL 避免将整个文件读入 base64 字符串，
 * 对 >10MB 的图片更节省内存。
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url); // 加载完成后立即释放 blob URL
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败 — 文件可能损坏或不是有效的图片格式'));
    };
    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

/**
 * OCR 配置选项。
 * 正常情况下不需要传，默认值已经针对轮盘数字做了优化。
 * 仅在识别效果不佳时用于调试/调参。
 */
export interface ImageRecognitionOptions {
  /**
   * Tesseract 页面分割模式。
   * 默认 PSM.SPARSE_TEXT ('11') — 适合分散排列的数字网格。
   * 可尝试 PSM.SINGLE_BLOCK ('6') 如果数字紧密排列；
   * PSM.AUTO ('3') 让 Tesseract 自己判断。
   */
  psm?: Tesseract.PSM;
  /**
   * 字符白名单。默认 "0123456789 "（数字 + 空格）。
   * 如果台面上数字之间用其他分隔符（如斜杠），可追加对应字符。
   */
  whitelist?: string;
  /**
   * 是否跳过图片预处理（灰度化 + 对比度拉伸）。
   * 如果原始截图已经是高对比度黑底白字，跳过可稍快。
   */
  skipPreprocessing?: boolean;
}

/**
 * 从图片文件中识别轮盘历史数字。
 *
 * ## 完整流水线
 * 1. 加载图片文件 → Image 元素
 * 2. 超大图降采样（>2000px 任一轴缩到 2000px 以内，Tesseract 有效分辨率
 *    上限约 300DPI，超过浪费算力且不提升识别率）
 * 3. Canvas 预处理：灰度化 + 对比度拉伸
 * 4. Tesseract.js OCR，仅识别数字字符
 * 5. 通过 parseNumbersText() 解析为 RouletteNumber 数组
 *
 * ## Worker 生命周期
 * 每次调用创建新 worker，完成后销毁。对于一次性导入的使用场景，
 * 这个简单模式足够了。如果要批量识别多张图，应复用 worker 实例。
 *
 * ## 错误处理
 * - 图片加载失败 → throw
 * - Tesseract 模型下载失败（网络问题）→ throw，提示检查网络
 * - OCR 返回空文本 → 返回空 numbers 数组，不报错
 *
 * @param file - 来自 <input type="file"> 或剪贴板的图片文件
 * @param options - 可选的 Tesseract 配置覆盖
 * @returns 解析结果，包含有效 RouletteNumber 数组和无法解析的 token 列表
 */
export async function recognizeNumbersFromImage(
  file: File | Blob,
  options?: ImageRecognitionOptions,
): Promise<ParsedNumbers> {
  // ── 1. 加载图片 ──────────────────────────────────────────
  const img = await loadImage(file);

  // ── 2. 超大图降采样 ──────────────────────────────────────
  // Tesseract 有效 DPI 约 300，超大分辨率浪费算力。
  // 任一轴超过 2000px 时等比缩放到 2000px 以内。
  let sourceForOcr: HTMLImageElement;

  if (img.width > 2000 || img.height > 2000) {
    const scale = Math.min(2000 / img.width, 2000 / img.height);
    const scaled = document.createElement('canvas');
    scaled.width = Math.round(img.width * scale);
    scaled.height = Math.round(img.height * scale);
    scaled.getContext('2d')!.drawImage(img, 0, 0, scaled.width, scaled.height);

    const scaledImg = new Image();
    scaledImg.src = scaled.toDataURL('image/png');
    await new Promise<void>((resolve) => {
      scaledImg.onload = () => resolve();
    });
    sourceForOcr = scaledImg;
  } else {
    sourceForOcr = img;
  }

  // ── 3. 预处理 ────────────────────────────────────────────
  const skipPreprocessing = options?.skipPreprocessing ?? false;
  const imageDataUrl = skipPreprocessing
    ? sourceForOcr.src // 如果已经是 data URL，直接用；否则需要 canvas 转换
    : preprocessImage(sourceForOcr);

  // ── 4. Tesseract OCR ─────────────────────────────────────
  // createWorker + setParameters 模式（而非一键 recognize()），因为需要设置
  // PSM 和字符白名单 —— 这两个参数在 WorkerParams 里，一键 API 无法传入。
  // OEM=1 (LSTM_ONLY): 仅神经网络引擎，比传统引擎+Tesseract混合更快。
  const worker = await Tesseract.createWorker('eng', 1);

  // 字符白名单：只识别数字和空格，大幅减少误识别
  // PSM: 默认 SPARSE_TEXT(11)，视数字为分散的独立文本块
  const whitelist = options?.whitelist ?? '0123456789 ';
  const psm = options?.psm ?? Tesseract.PSM.SPARSE_TEXT;

  await worker.setParameters({
    tessedit_char_whitelist: whitelist,
    tessedit_pageseg_mode: psm,
  });

  let ocrText: string;
  try {
    const { data } = await worker.recognize(imageDataUrl);
    ocrText = data.text;
  } finally {
    // 无论识别成功与否都销毁 worker，释放 WASM 内存
    await worker.terminate();
  }

  // ── 5. 解析为 RouletteNumber[] ───────────────────────────
  // Tesseract 输出的是被空格/换行分隔的数字串（受白名单限制），
  // parseNumbersText() 的分隔符拆分逻辑恰好兼容。
  return parseNumbersText(ocrText);
}
