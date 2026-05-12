pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
-- p8go bridge feasibility probe

function _init()
 printh("p8go_probe:init")
 for i=0,15 do
  poke(0x5f80+i,i)
 end
end

function _update60()
 local s=peek(0x5f80)
 poke(0x5f80,(s+1)%256)
 poke(0x5f81,flr(t()*60)%256)
 if s==8 then
  printh("p8go_probe:seq8")
 end
 if s>20 then
  printh("p8go_probe:done")
  extcmd("shutdown")
 end
end

function _draw()
 cls(0)
 print("p8go",8,8,7)
 print(peek(0x5f80),8,16,11)
end
