var net = require('net');

conn = net.createConnection({port:5000, host:'localhost'}, function(c) {
    conn.write(new Buffer('000F32321C3030313030303030311C1C39', 'hex'));
    conn.write(new Buffer('0036341C3030311C1C3030371C30303030303030301C30303030351C313031434152443A2035383539203837303020313230332033393439', 'hex'));
    conn.write(new Buffer('0081341C3030311C1C3133331C30303030303030301C30303030353036363036360C1B504555545377697463684346435F3036362E424D501B1B5B30303B46343B38306D1B5B30303B46343B38306D0F4631313031333135393532393533370F4931333031343338333639383335360F4C31343031323734373837353130371C323030', 'hex'));
    conn.write(new Buffer('0102341C3030311C1C3035351C30303030303030301C30363836353034363034360C1B504555545377697463684346435F3034362E424D501B1B5B30303B46343B38306D0F484B0F494B332E30331C3330331B5B303030701B5B303430711B28490A0A0A0A0A0A42414C414E434520494E51554952590A0A44415445090954494D4509534551230A0A30322D31322D323031342031343A35333A323809303638360A0A434152443A20353835395858585858585858333934390A4143434F554E543A20313031333135393532393533370A0A41544D2049443A2041636372610A5452414E53414354494F4E233A20383036370A0A415641494C41424C453A20332E30330C', 'hex'));
    conn.write(new Buffer('000F32321C3030313030303030311C1C39'));
});
