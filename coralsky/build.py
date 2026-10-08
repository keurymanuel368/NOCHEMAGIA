import sys
t=open('/home/user/NOCHEMAGIA/coralsky/film.html').read()
f=open('/home/user/NOCHEMAGIA/coralsky/fonts.css').read()
open('/tmp/claude-0/-home-user-NOCHEMAGIA/ab9974b9-4fa7-55d9-966a-81667532d070/scratchpad/film.build.html','w').write(t.replace('/*FONTS*/',f))
