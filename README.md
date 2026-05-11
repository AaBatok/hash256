## HASH256 GPU

## Install

```
git clone https://github.com/AaBatok/hash256
cd hash256
npm install
cp .env.example .env
nano .env
```

Isi
```
RPC_URL=https://ethereum-rpc.publicnode.com
PRIVATE_KEY=0xPRIVATE_KEY_WALLET_KAMU
MINER_BACKEND=auto
CPU_WORKERS=
PRIORITY_FEE_GWEI=4
```
- Masukan PK depan tambahin 0x
- CPU Worker masukin sesuai spek CPU
- GWEI bebas mau di set di berapapun

Cek Kontrak
```
npm run check
```

Install dependency
```
sudo apt update
sudo apt install -y build-essential ocl-icd-opencl-dev clinfo
```

Cek OpenCL:
```
clinfo | head
```

Build miner GPU:
```
sed -i 's/\r$//' scripts/build-opencl.sh
```

```
mkdir -p bin
```

```
bash scripts/build-opencl.sh
```

Run
```
screen -S hash256
```

```
npm run start:gpu
```

## Credit Thx to : https://github.com/mrfunntastiic
- Saya hanya merubah beberapa file untuk Logs
