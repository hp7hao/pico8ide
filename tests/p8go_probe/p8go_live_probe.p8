pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
-- long-running p8go bridge feasibility probe

function _init()
 printh("p8go_live_probe:init")
 for i=0,31 do
  poke(0x5f80+i,0)
 end
end

function _update60()
 local seq=(peek(0x5f80)+1)%256
 local host=peek(0x5f90)
 poke(0x5f80,seq)
 poke(0x5f81,0x70)
 poke(0x5f82,0x38)
 poke(0x5f83,0x67)
 poke(0x5f84,0x6f)
 poke(0x5f85,0x21)
 poke(0x5f86,flr(t()*60)%256)
 poke(0x5f91,(host+1)%256)
end

function _draw()
 cls(0)
 print("p8go live",8,8,7)
 print(peek(0x5f80),8,16,11)
end
