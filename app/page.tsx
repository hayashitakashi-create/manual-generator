'use client';

import { useState, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface ImageFile {
  name: string;
  dataUrl: string;
}

export default function Home() {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [images, setImages] = useState<ImageFile[]>([]);
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');

  // MDファイルのアップロード処理
  const handleMarkdownUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setMarkdownContent(event.target?.result as string);
    };
    reader.readAsText(file);
  };

  // 画像ファイルのアップロード処理（複数対応）
  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imagePromises = Array.from(files).map((file) => {
      return new Promise<ImageFile>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({ name: file.name, dataUrl: event.target?.result as string });
        };
        reader.readAsDataURL(file);
      });
    });
    Promise.all(imagePromises).then((loadedImages) => {
      setImages((prev) => [...prev, ...loadedImages]);
    });
  };

  // ロゴアップロード処理
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoDataUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 画像名からdataUrlを取得するマップ
  const imageMap = useMemo(() => {
    const map = new Map<string, string>();
    images.forEach((img) => map.set(img.name, img.dataUrl));
    return map;
  }, [images]);

  // 画像パスからファイル名を抽出して、対応するdataUrlを返す
  const resolveImageSrc = useCallback(
    (src: string): string | null => {
      const fileName = src.split('/').pop();
      if (!fileName) return null;
      return imageMap.get(fileName) || null;
    },
    [imageMap]
  );

  // 突合状況の計算
  const matchStatus = useMemo(() => {
    if (!markdownContent) return { total: 0, matched: 0, unmatched: [] as string[] };
    const imageRefRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const refs: string[] = [];
    let match;
    while ((match = imageRefRegex.exec(markdownContent)) !== null) {
      refs.push(match[2]);
    }
    const unmatched: string[] = [];
    let matched = 0;
    refs.forEach((ref) => {
      const fileName = ref.split('/').pop();
      if (fileName && imageMap.has(fileName)) {
        matched++;
      } else {
        unmatched.push(ref);
      }
    });
    return { total: refs.length, matched, unmatched };
  }, [markdownContent, imageMap]);

  // ReactMarkdownのカスタムコンポーネント
  const markdownComponents: Components = useMemo(
    () => ({
      img: ({ src, alt, ...props }) => {
        if (!src) return null;
        const resolved = resolveImageSrc(src);
        if (resolved) {
          return (
            <img
              src={resolved}
              alt={alt || ''}
              style={{ maxWidth: '100%', height: 'auto', margin: '16px 0', borderRadius: '4px', border: '1px solid #e5e7eb' }}
              {...props}
            />
          );
        }
        return (
          <div style={{ padding: '24px', background: '#fef2f2', border: '1px dashed #fca5a5', borderRadius: '8px', textAlign: 'center', margin: '16px 0', color: '#dc2626', fontSize: '14px' }}>
            画像未対応: {src.split('/').pop()}
          </div>
        );
      },
    }),
    [resolveImageSrc]
  );

  // PDF生成（大項目ごとにページ分割 + ヘッダーロゴ + ページ番号）
  const generatePDF = () => {
    const previewEl = document.getElementById('preview-content');
    if (!previewEl) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('ポップアップがブロックされました。ポップアップを許可してください。');
      return;
    }

    // プレビューのHTMLを取得して、h2ごとにセクション分割
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = previewEl.innerHTML;

    const sections: string[] = [];
    let currentSection = '';
    let sectionCount = 0;

    Array.from(tempDiv.childNodes).forEach((node) => {
      const el = node as HTMLElement;
      if (el.tagName === 'H2') {
        // 既存のセクションを保存
        if (currentSection.trim()) {
          sections.push(currentSection);
        }
        sectionCount++;
        currentSection = el.outerHTML || '';
      } else if (el.tagName === 'HR') {
        // hrは無視（セクション区切りとして使用しない）
      } else {
        if (el.outerHTML) {
          currentSection += el.outerHTML;
        } else if (el.textContent?.trim()) {
          currentSection += el.textContent;
        }
      }
    });
    // 最後のセクションを保存
    if (currentSection.trim()) {
      sections.push(currentSection);
    }

    const totalPages = sections.length;
    const logoImg = logoDataUrl
      ? `<img src="${logoDataUrl}" alt="Logo" class="header-logo" />`
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
          @page {
            size: A4;
            margin: 0;
          }

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

          .page-section:last-child {
            page-break-after: auto;
          }

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

          .page-body {
            min-height: calc(297mm - 20mm - 25mm - 60px - 40px);
          }

          .page-footer {
            position: absolute;
            bottom: 20mm;
            right: 25mm;
            text-align: right;
          }

          .page-number {
            font-size: 11px;
            color: #9ca3af;
          }

          /* Typography */
          h1 {
            font-size: 26px;
            font-weight: bold;
            margin: 0 0 16px;
            padding-bottom: 10px;
            border-bottom: 3px solid #2563eb;
            color: #1e40af;
          }

          h2 {
            font-size: 21px;
            font-weight: bold;
            margin: 0 0 14px;
            padding-bottom: 8px;
            border-bottom: 2px solid #93c5fd;
            color: #1e40af;
          }

          h3 {
            font-size: 17px;
            font-weight: bold;
            margin: 18px 0 8px;
            color: #1e3a5f;
          }

          h4 {
            font-size: 15px;
            font-weight: bold;
            margin: 14px 0 6px;
            color: #374151;
          }

          p { margin: 6px 0; font-size: 13px; }
          ul, ol { margin: 6px 0; padding-left: 22px; font-size: 13px; }
          li { margin: 3px 0; }

          img {
            max-width: 100%;
            height: auto;
            margin: 12px 0;
            border: 1px solid #d1d5db;
            border-radius: 4px;
          }

          hr { display: none; }

          strong { font-weight: bold; color: #1e3a5f; }

          a { color: #2563eb; text-decoration: underline; }

          code {
            background: #f3f4f6;
            padding: 1px 5px;
            border-radius: 3px;
            font-size: 12px;
          }

          @media print {
            .page-section {
              page-break-after: always;
            }
            .page-section:last-child {
              page-break-after: auto;
            }
            h2, h3 { page-break-after: avoid; }
            img { page-break-inside: avoid; }
          }

          /* Screen preview (before printing) */
          @media screen {
            body { background: #f0f0f0; }
            .page-section {
              background: white;
              margin: 20px auto;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
          }
        </style>
      </head>
      <body>
        ${sectionHTML}
      </body>
      </html>
    `);

    printWindow.document.close();

    // 画像の読み込みを待ってから印刷
    const imgs = printWindow.document.querySelectorAll('img');
    let loaded = 0;
    const totalImgs = imgs.length;

    const triggerPrint = () => {
      setTimeout(() => {
        printWindow.print();
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

  // 画像削除処理
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            マニュアル作成アプリ
          </h1>
          <p className="text-gray-600">
            MDファイルと画像をアップロードして、PDFマニュアルを生成します
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左側: アップロードエリア */}
          <div className="space-y-6">
            {/* MDファイルアップロード */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                1. MDファイルをアップロード
              </h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept=".md"
                  onChange={handleMarkdownUpload}
                  className="hidden"
                  id="markdown-upload"
                />
                <label htmlFor="markdown-upload" className="cursor-pointer flex flex-col items-center">
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm text-gray-600">クリックしてMDファイルを選択</span>
                </label>
              </div>
              {markdownContent && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm text-green-700">MDファイルが読み込まれました</p>
                </div>
              )}
            </div>

            {/* 画像ファイルアップロード */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                2. スクリーンショットをアップロード
              </h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImagesUpload}
                  className="hidden"
                  id="images-upload"
                />
                <label htmlFor="images-upload" className="cursor-pointer flex flex-col items-center">
                  <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-600">クリックして画像を選択（複数可）</span>
                </label>
              </div>
              {images.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-700">アップロード済み画像 ({images.length}件)</p>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {images.map((img, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-700 truncate flex-1">{img.name}</span>
                        <button onClick={() => removeImage(index)} className="ml-2 text-red-500 hover:text-red-700">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ロゴアップロード */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                3. ヘッダーロゴをアップロード
              </h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  id="logo-upload"
                />
                <label htmlFor="logo-upload" className="cursor-pointer flex flex-col items-center">
                  <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  <span className="text-sm text-gray-600">クリックしてロゴ画像を選択</span>
                </label>
              </div>
              {logoDataUrl && (
                <div className="mt-4 flex items-center gap-4 p-3 bg-green-50 border border-green-200 rounded">
                  <img src={logoDataUrl} alt="Logo preview" className="h-8 w-auto" />
                  <p className="text-sm text-green-700 flex-1">ロゴが設定されました</p>
                  <button
                    onClick={() => setLogoDataUrl('')}
                    className="text-red-500 hover:text-red-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* 突合状況 */}
            {markdownContent && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  突合状況
                </h2>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">MD内の画像参照数:</span>
                    <span className="font-semibold">{matchStatus.total}件</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">マッチ済み:</span>
                    <span className="font-semibold text-green-600">{matchStatus.matched}件</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">未マッチ:</span>
                    <span className="font-semibold text-red-600">{matchStatus.unmatched.length}件</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
                    <div
                      className="bg-green-500 h-3 rounded-full transition-all"
                      style={{ width: matchStatus.total > 0 ? `${(matchStatus.matched / matchStatus.total) * 100}%` : '0%' }}
                    />
                  </div>
                  {matchStatus.unmatched.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="text-xs font-semibold text-red-700 mb-1">未マッチの画像:</p>
                      {matchStatus.unmatched.map((ref, i) => (
                        <p key={i} className="text-xs text-red-600">{ref.split('/').pop()}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PDF生成ボタン */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                4. PDFを生成
              </h2>
              <button
                onClick={generatePDF}
                disabled={!markdownContent}
                className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                  !markdownContent
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                }`}
              >
                PDFを生成
              </button>
              <p className="text-xs text-gray-500 mt-2">
                印刷ダイアログで「PDFとして保存」を選択してください
              </p>
            </div>
          </div>

          {/* 右側: プレビューエリア */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              プレビュー
            </h2>
            <div
              id="preview-content"
              className="prose max-w-none h-[calc(100vh-16rem)] overflow-y-auto border border-gray-200 rounded p-6 bg-white"
            >
              {markdownContent ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={markdownComponents}
                >
                  {markdownContent}
                </ReactMarkdown>
              ) : (
                <div className="text-center text-gray-400 py-12">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>MDファイルをアップロードするとプレビューが表示されます</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
