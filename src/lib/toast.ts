import { toast as sonnerToast } from 'sonner';

const TOAST_DURATION = 4000;

export const toast = {
  success: (message: string) => {
    sonnerToast.success(message, { duration: TOAST_DURATION });
  },
  error: (message: string) => {
    sonnerToast.error(message, { duration: TOAST_DURATION });
  },
  info: (message: string) => {
    sonnerToast.info(message, { duration: TOAST_DURATION });
  },
  loading: (message: string) => {
    return sonnerToast.loading(message, { duration: TOAST_DURATION });
  },
};
