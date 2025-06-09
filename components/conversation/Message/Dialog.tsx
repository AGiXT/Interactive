'use client';

import React, { MouseEventHandler, useState } from 'react';
import { IoIosClose } from 'react-icons/io';
import { Button } from '@/components/ui/button';
import { Dialog as CnDialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';

export type CommonDialogProps = {
  onClose?: () => void;
  title?: string;
  sx?: { [key: string]: string | number };
};
export type DialogProps = CommonDialogProps & {
  onConfirm?: (data?: any) => void;
  content?: React.ReactNode | string;
  ButtonComponent?: React.FC<{ onClick: MouseEventHandler<any> }> | any;
  ButtonProps?: object;
  className?: string;
};

const Dialog = React.forwardRef<
  HTMLButtonElement,
  DialogProps
>(({
  onClose = (): object => ({}),
  onConfirm,
  title = 'Dialog Title',
  content = '',
  ButtonComponent = Button,
  ButtonProps = {},
  sx = {},
  className,
}, ref) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  
  function handleClose(): void {
    setDialogOpen(false);
    onClose();
  }

  function handleCancel(): void {
    handleClose();
  }
  
  return (
    <>
      <ButtonComponent
        ref={ref}
        onClick={() => {
          setDialogOpen(true);
        }}
        {...ButtonProps}
      />
      <CnDialog open={dialogOpen}>
        <DialogContent className={className}>
          <Button onClick={handleClose} variant='ghost' size='icon' className='absolute top-2 right-2'>
            <IoIosClose />
          </Button>
          {title && (
            <DialogTitle id='dialog-title' className='text-center'>
              {title}
            </DialogTitle>
          )}
          <div className='relative flex items-center justify-center'>
            {typeof content === 'string' ? (
              <p className='text-center' id='dialog-description'>
                {content}
              </p>
            ) : (
              content
            )}
          </div>
          {onConfirm && (
            <DialogFooter className='flex justify-center'>
              <Button onClick={handleCancel}>Cancel</Button>
              <Button
                onClick={() => {
                  setDialogOpen(false);
                  onConfirm();
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </CnDialog>
    </>
  );
});

Dialog.displayName = 'Dialog';

export default Dialog;
