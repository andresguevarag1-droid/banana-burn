from pathlib import Path
import subprocess, zlib
p=Path(__file__).resolve().parent
url=b'https://www.bananaburn.app/c/soho-paradisus'

def read_matrix(name,origin,extent):
    f=p/name
    size=subprocess.check_output(['identify','-format','%w %h',str(f)]).decode().split()
    w,h=map(int,size)
    rgb=subprocess.check_output(['convert',str(f),'-alpha','off','-depth','8','rgb:-'])
    ox,oy=origin
    m=[]
    for y in range(33):
        row=[]
        for x in range(33):
            px=int(ox+(x+4.5)*extent/41)
            py=int(oy+(y+4.5)*extent/41)
            row.append(rgb[(py*w+px)*3]<128)
        m.append(row)
    return m

ref=read_matrix('qr.png',(0,0),492)
for name,origin,extent in [('historia.png',(68,1166),225),('afiche-a4.png',(68*2480/1080,1016*2480/1080),225*2480/1080)]:
    assert read_matrix(name,origin,extent)==ref, name
    print(name+': QR renderizado idéntico al original')

# Decode the raster directly. Exclude function patterns by their geometric regions.
def reserved(x,y):
    return ((x<=8 and y<=8) or (x>=25 and y<=8) or (x<=8 and y>=25)
            or x==6 or y==6 or (24<=x<=28 and 24<=y<=28))
bits=[]
right=32
up=True
while right>0:
    if right==6: right=5
    for y in (range(32,-1,-1) if up else range(33)):
        for x in (right,right-1):
            if not reserved(x,y): bits.append(int(ref[y][x]) ^ int((x+y)%2==0))
    up=not up
    right-=2
assert len(bits)==807
words=[sum(bits[j+i]<<(7-i) for i in range(8)) for j in range(0,800,8)]
assert bits[:4]==[0,1,0,0]
length=sum(bits[4+i]<<(7-i) for i in range(8))
result=bytes(sum(bits[12+j*8+i]<<(7-i) for i in range(8)) for j in range(length))
assert result==url

def gf(a,b):
    v=0
    while b:
        if b&1: v^=a
        a<<=1
        if a&256: a^=285
        b>>=1
    return v
root=1
for i in range(20):
    syndrome=0
    for word in words: syndrome=gf(syndrome,root)^word
    assert syndrome==0,(i,syndrome)
    root=gf(root,2)
print('QR: URL exacta y 20 síndromes Reed-Solomon correctos')
pdf=(p/'afiche-a4.pdf').read_bytes()
assert b'/MediaBox [0 0 595.275591 841.889764]' in pdf
start=pdf.index(b'stream\n')+7
end=pdf.index(b'\nendstream',start)
assert zlib.decompress(pdf[start:end])==subprocess.check_output(['convert',str(p/'afiche-a4.png'),'-alpha','off','-depth','8','rgb:-'])
print('PDF: A4 exacto y contenido RGB idéntico al PNG')
s=(p/'mensajes.txt').read_text()
short=s.split('VERSIÓN CORTA (3 líneas)\n')[1].split('\n\n')[0]
assert len(short.splitlines())==3
assert not any(c in s for c in ['—','·','¡'])
print('Mensajes: versión corta de 3 líneas; sin rayas largas, separadores ni exclamaciones')
