let io;

export const initIo = (serverIo) => {
    io = serverIo;
};

export const getIo = () => {
    return io;
};
