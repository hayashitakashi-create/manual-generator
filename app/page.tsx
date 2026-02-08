'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { FileText, Image, Sparkles, Check, Download, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface ImageFile {
  name: string;
  dataUrl: string;
  file: File;
}

export default function Home() {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [mdFile, setMdFile] = useState<File | null>(null);
  const [screenshots, setScreenshots] = useState<ImageFile[]>([]);
  const [logo, setLogo] = useState<ImageFile | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // MDファイルのアップロード処理
  const handleMdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMdFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setMarkdownContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  // 画像ファイルのアップロード処理（複数対応）
  const handleScreenshotsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imagePromises = Array.from(files).map((file) => {
      return new Promise<ImageFile>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({ name: file.name, dataUrl: event.target?.result as string, file });
        };
        reader.readAsDataURL(file);
      });
    });
    Promise.all(imagePromises).then((loadedImages) => {
      setScreenshots((prev) => [...prev, ...loadedImages]);
    });
  };

  // ロゴアップロード処理
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogo({ name: file.name, dataUrl: event.target?.result as string, file });
    };
    reader.readAsDataURL(file);
  };

  // 画像名からdataUrlを取得するマップ
  const imageMap = useMemo(() => {
    const map = new Map<string, string>();
    screenshots.forEach((img) => map.set(img.name, img.dataUrl));
    return map;
  }, [screenshots]);

  // 画像パスからファイル名を抽出して、対応するdataUrlを返す
  const resolveImageSrc = useCallback(
    (src: string): string | null => {
      const fileName = src.split('/').pop();
      if (!fileName) return null;
      return imageMap.get(fileName) || null;
    },
    [imageMap]
  );

  // ReactMarkdownのカスタムコンポーネント
  const markdownComponents: Components = useMemo(
    () => ({
      img: ({ src, alt }) => {
        const srcStr = typeof src === 'string' ? src : '';
        if (!srcStr) return null;
        const resolved = resolveImageSrc(srcStr);
        if (resolved) {
          return (
            <img
              src={resolved}
              alt={typeof alt === 'string' ? alt : ''}
              style={{ maxWidth: '100%', height: 'auto', margin: '16px 0', borderRadius: '4px', border: '1px solid #e5e7eb' }}
            />
          );
        }
        return (
          <div style={{ padding: '24px', background: '#fef2f2', border: '1px dashed #fca5a5', borderRadius: '8px', textAlign: 'center', margin: '16px 0', color: '#dc2626', fontSize: '14px' }}>
            画像未対応: {srcStr.split('/').pop()}
          </div>
        );
      },
    }),
    [resolveImageSrc]
  );

  // PDF生成（大項目ごとにページ分割 + ヘッダーロゴ + ページ番号）
  const generatePDF = async () => {
    setIsGenerating(true);

    // 2秒のローディング表示
    await new Promise(resolve => setTimeout(resolve, 2000));

    const previewEl = document.getElementById('preview-content');
    if (!previewEl) {
      setIsGenerating(false);
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('ポップアップがブロックされました。ポップアップを許可してください。');
      setIsGenerating(false);
      return;
    }

    // プレビューのHTMLを取得して、h2ごとにセクション分割
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = previewEl.innerHTML;

    const sections: string[] = [];
    let currentSection = '';

    Array.from(tempDiv.childNodes).forEach((node) => {
      const el = node as HTMLElement;
      if (el.tagName === 'H2') {
        if (currentSection.trim()) {
          sections.push(currentSection);
        }
        currentSection = el.outerHTML || '';
      } else if (el.tagName === 'HR') {
        // hrは無視
      } else {
        if (el.outerHTML) {
          currentSection += el.outerHTML;
        } else if (el.textContent?.trim()) {
          currentSection += el.textContent;
        }
      }
    });
    if (currentSection.trim()) {
      sections.push(currentSection);
    }

    const totalPages = sections.length;
    const logoImg = logo
      ? `<img src="${logo.dataUrl}" alt="Logo" class="header-logo" />`
      : '';

    const sectionHTML = sections
      .map(
        (content, index) => `
        <div class="page-section">
          <div class="page-header">
            ${logoImg}
          </div>
          <div class="page-body">
            ${content}
          </div>
          <div class="page-footer">
            <span class="page-number">${index + 1} / ${totalPages}</span>
          </div>
        </div>
      `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>マニュアル</title>
        <style>
          @page { size: A4; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif;
            color: #1a1a1a;
            line-height: 1.8;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page-section {
            width: 210mm;
            min-height: 297mm;
            padding: 20mm 25mm 25mm 25mm;
            page-break-after: always;
            position: relative;
            box-sizing: border-box;
          }
          .page-section:last-child { page-break-after: auto; }
          .page-header {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding-bottom: 12px;
            margin-bottom: 16px;
            border-bottom: 2px solid #e5e7eb;
            min-height: 40px;
          }
          .header-logo {
            height: 32px;
            width: auto;
            border: none !important;
            margin: 0 !important;
            border-radius: 0 !important;
          }
          .page-body { min-height: calc(297mm - 20mm - 25mm - 60px - 40px); }
          .page-footer {
            position: absolute;
            bottom: 20mm;
            right: 25mm;
            text-align: right;
          }
          .page-number { font-size: 11px; color: #9ca3af; }
          h1 { font-size: 26px; font-weight: bold; margin: 0 0 16px; padding-bottom: 10px; border-bottom: 3px solid #2563eb; color: #1e40af; }
          h2 { font-size: 21px; font-weight: bold; margin: 0 0 14px; padding-bottom: 8px; border-bottom: 2px solid #93c5fd; color: #1e40af; }
          h3 { font-size: 17px; font-weight: bold; margin: 18px 0 8px; color: #1e3a5f; }
          h4 { font-size: 15px; font-weight: bold; margin: 14px 0 6px; color: #374151; }
          p { margin: 6px 0; font-size: 13px; }
          ul, ol { margin: 6px 0; padding-left: 22px; font-size: 13px; }
          li { margin: 3px 0; }
          img { max-width: 100%; height: auto; margin: 12px 0; border: 1px solid #d1d5db; border-radius: 4px; }
          hr { display: none; }
          strong { font-weight: bold; color: #1e3a5f; }
          a { color: #2563eb; text-decoration: underline; }
          code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-size: 12px; }
          @media print {
            .page-section { page-break-after: always; }
            .page-section:last-child { page-break-after: auto; }
            h2, h3 { page-break-after: avoid; }
            img { page-break-inside: avoid; }
          }
          @media screen {
            body { background: #f0f0f0; }
            .page-section { background: white; margin: 20px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
          }
        </style>
      </head>
      <body>${sectionHTML}</body>
      </html>
    `);

    printWindow.document.close();

    const imgs = printWindow.document.querySelectorAll('img');
    let loaded = 0;
    const totalImgs = imgs.length;

    const triggerPrint = () => {
      setTimeout(() => {
        printWindow.print();
        setIsGenerating(false);
      }, 800);
    };

    if (totalImgs === 0) {
      triggerPrint();
    } else {
      imgs.forEach((img) => {
        if (img.complete) {
          loaded++;
          if (loaded === totalImgs) triggerPrint();
        } else {
          img.onload = () => {
            loaded++;
            if (loaded === totalImgs) triggerPrint();
          };
          img.onerror = () => {
            loaded++;
            if (loaded === totalImgs) triggerPrint();
          };
        }
      });
    }
  };

  const isValid = mdFile !== null && screenshots.length > 0;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const cards = [
    {
      step: 1,
      title: 'MDファイル',
      description: 'マニュアルのマークダウンファイル',
      icon: FileText,
      required: true,
      completed: mdFile !== null,
      file: mdFile,
      accept: '.md',
      onChange: handleMdUpload,
      inputId: 'md-upload',
    },
    {
      step: 2,
      title: 'スクリーンショット',
      description: '説明用の画像ファイル（複数可）',
      icon: Image,
      required: true,
      completed: screenshots.length > 0,
      files: screenshots,
      accept: 'image/*',
      multiple: true,
      onChange: handleScreenshotsUpload,
      inputId: 'screenshots-upload',
    },
    {
      step: 3,
      title: 'ロゴ',
      description: 'ヘッダーに表示するロゴ画像',
      icon: Sparkles,
      required: false,
      completed: logo !== null,
      file: logo,
      accept: 'image/*',
      onChange: handleLogoUpload,
      inputId: 'logo-upload',
    },
  ];

  return (
    <div className="min-h-screen bg-[#e0e5ec] py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff] mb-6">
            <FileText className="w-10 h-10 text-gray-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            マニュアル作成アプリ
          </h1>
          <p className="text-gray-500">ニューモーフィズムデザイン</p>
        </motion.header>

        {/* カードグリッド */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {cards.map((card, index) => (
            <motion.div
              key={card.step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff] p-6 hover:shadow-[12px_12px_20px_#b8b9be,-12px_-12px_20px_#ffffff] transition-all duration-300"
            >
              {/* ステップ番号とアイコン */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff] flex items-center justify-center text-gray-600 font-semibold">
                    {card.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{card.title}</h3>
                    {card.required ? (
                      <span className="text-xs text-red-400">必須</span>
                    ) : (
                      <span className="text-xs text-gray-400">オプション</span>
                    )}
                  </div>
                </div>
                {card.completed && (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-500 mb-4">{card.description}</p>

              {/* アップロードエリア */}
              <label
                htmlFor={card.inputId}
                className="block cursor-pointer"
              >
                <div className={`rounded-2xl p-6 text-center transition-all duration-300 ${
                  card.completed
                    ? 'bg-gradient-to-br from-gray-100 to-gray-200 shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff]'
                    : 'bg-gradient-to-br from-gray-100 to-gray-200 shadow-[4px_4px_8px_#b8b9be,-4px_-4px_8px_#ffffff] hover:shadow-[6px_6px_12px_#b8b9be,-6px_-6px_12px_#ffffff]'
                }`}>
                  <input
                    type="file"
                    id={card.inputId}
                    accept={card.accept}
                    multiple={'multiple' in card && card.multiple}
                    onChange={card.onChange}
                    className="hidden"
                  />
                  <card.icon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    {card.completed ? 'ファイルを変更' : 'クリックしてアップロード'}
                  </p>
                </div>
              </label>

              {/* ファイル情報表示 */}
              {'file' in card && card.file && (
                <div className="mt-4 p-3 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-[inset_2px_2px_4px_#b8b9be,inset_-2px_-2px_4px_#ffffff]">
                  <p className="text-sm font-medium text-gray-700 truncate">{card.file.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(card.file instanceof File ? card.file.size : card.file.file.size)}</p>
                </div>
              )}

              {'files' in card && card.files && card.files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-gray-600 font-medium">{card.files.length}件のファイル</p>
                  {/* サムネイルプレビュー（最大3枚） */}
                  <div className="flex gap-2">
                    {card.files.slice(0, 3).map((img, i) => (
                      <div
                        key={i}
                        className="w-16 h-16 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 shadow-[inset_2px_2px_4px_#b8b9be,inset_-2px_-2px_4px_#ffffff] overflow-hidden"
                      >
                        <img
                          src={img.dataUrl}
                          alt={img.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {card.files.length > 3 && (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 shadow-[inset_2px_2px_4px_#b8b9be,inset_-2px_-2px_4px_#ffffff] flex items-center justify-center">
                        <span className="text-sm text-gray-500">+{card.files.length - 3}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* 生成ボタン */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex justify-center mb-12"
        >
          <motion.button
            onClick={generatePDF}
            disabled={!isValid || isGenerating}
            whileHover={isValid && !isGenerating ? { scale: 1.02 } : {}}
            whileTap={isValid && !isGenerating ? { scale: 0.98 } : {}}
            className={`rounded-2xl px-8 py-4 font-semibold transition-all duration-300 flex items-center gap-3 ${
              isValid && !isGenerating
                ? 'bg-gradient-to-br from-gray-100 to-gray-200 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff] text-gray-700 hover:shadow-[12px_12px_20px_#b8b9be,-12px_-12px_20px_#ffffff] active:shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff] active:scale-95'
                : 'bg-gradient-to-br from-gray-200 to-gray-300 shadow-[inset_4px_4px_8px_#b8b9be,inset_-4px_-4px_8px_#ffffff] text-gray-400 cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 className="w-5 h-5" />
                </motion.div>
                <span>生成中...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>PDFを生成する</span>
              </>
            )}
          </motion.button>
        </motion.div>

        {/* プレビューエリア */}
        {markdownContent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-[8px_8px_16px_#b8b9be,-8px_-8px_16px_#ffffff] p-8"
          >
            <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              プレビュー
            </h2>
            <div
              id="preview-content"
              className="prose max-w-none p-6 rounded-2xl bg-white shadow-[inset_4px_4px_8px_#d1d5db,inset_-4px_-4px_8px_#ffffff] max-h-[60vh] overflow-y-auto"
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {markdownContent}
              </ReactMarkdown>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
