import { KeyboardEventHandler } from "react";
import tw from "tailwind-styled-components"

export const Row = tw.div`
    py-2
    flex
    flex-row
    flex-wrap
    gap-2
    items-center
`;

export const Container = tw.div`
    flex
    flex-col
    px-[5%]
    py-6
`;

export const Panel = tw.div`
    flex
    flex-col
    p-4
    my-3
    bg-gray-200
    rounded
`;

export const Divider = tw.hr`
    w-full
    border-gray-300
    border-1
    my-2
`;

const StyledInput = tw.input`
    font-mono
    bg-slate-50
    text-xs
    border-gray-300
    border-1
    rounded
    p-2
    h-6
    focus:outline-none
`;

export const Input = ({ onEnterKey, onKeyUpCapture, ...props }: { onEnterKey?: () => void, onKeyUpCapture?: (e: KeyboardEventHandler<HTMLInputElement>) => void } & JSX.IntrinsicElements['input']) => {
    return (
        <StyledInput {...props} onKeyUpCapture={e => { onEnterKey && e.key === 'Enter' && onEnterKey(); onKeyUpCapture && onKeyUpCapture(e) }} />
    )
};

export const Text = tw.p`
    text-xs
`;

export const WarnText = tw(Text)`
    text-red-500
`;

export const Button = tw.button`
    text-xs
    bg-gray-300
    rounded
    h-6
    px-4

    hover:bg-slate-300
`;

export const WarnButton = tw(Button)`
    bg-red-400
`;

export const PrimaryButton = tw(Button)`
    bg-blue-300
`;

const RawModal = tw.div`
    fixed
    inset-0
    bg-black
    bg-opacity-50
    block
`;

// Modal is a wrapper of RawModal, which has a required prop "z-index", all the other props will be passed to RawModal
export const Modal = ({ show, children, ...props }: { show: boolean, children: React.ReactNode } & JSX.IntrinsicElements['div']) => {
    return (
        <div className={show ? 'block' : 'hidden'}>
            <RawModal {...props}>
                {children}
            </RawModal>
        </div>
    )
};