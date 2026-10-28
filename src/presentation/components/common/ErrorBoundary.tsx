import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary
 * Commercial-grade fault isolation wrapper.
 * Prevents minor component render errors from crashing the entire React tree into a white screen.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[TamSpeak Fault Guard] Component render error captured:', error, errorInfo);
  }

  private handleRetry = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-6 m-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-950 shadow-xs max-w-lg mx-auto text-center animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3 text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm mb-1">
            {this.props.fallbackTitle || 'Không thể hiển thị khu vực này'}
          </h3>
          <p className="text-xs text-amber-800/80 mb-3 max-w-sm">
            {this.props.fallbackMessage ||
              'Đã xảy ra lỗi kết xuất tạm thời. Toàn bộ ứng dụng của bạn vẫn đang hoạt động an toàn.'}
          </p>
          {this.state.error && (
            <div className="mt-1 mb-4 p-2.5 rounded-lg bg-amber-100/70 border border-amber-300/60 text-[11px] font-mono text-amber-900 max-w-sm overflow-x-auto text-left break-words">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Tải lại khung này</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
