const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const { pki, md } = forge;

// Generate CA certificate if not exists
function generateCA() {
    const certPath = path.join(__dirname, '../certs/ca.crt');
    const keyPath = path.join(__dirname, '../certs/ca.key');

    if (fs.existsSync(certPath)) {
        return {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath)
        };
    }

    const keys = pki.rsa.generateKeyPair(2048);
    const cert = pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [
        { name: 'commonName', value: 'Proxy Scanner CA' },
        { name: 'organizationName', value: 'Proxy Scanner' },
        { name: 'countryName', value: 'US' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([{
        name: 'basicConstraints',
        cA: true
    }]);

    cert.sign(keys.privateKey, md.sha256.create());

    fs.writeFileSync(certPath, pki.certificateToPem(cert));
    fs.writeFileSync(keyPath, pki.privateKeyToPem(keys.privateKey));

    return {
        cert: pki.certificateToPem(cert),
        key: pki.privateKeyToPem(keys.privateKey)
    };
}

// Generate host certificate
function generateHostCert(hostname) {
    const caCert = pki.certificateFromPem(fs.readFileSync(path.join(__dirname, '../certs/ca.crt')));
    const caKey = pki.privateKeyFromPem(fs.readFileSync(path.join(__dirname, '../certs/ca.key')));

    const keys = pki.rsa.generateKeyPair(2048);
    const cert = pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '02';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [
        { name: 'commonName', value: hostname },
        { name: 'organizationName', value: 'Proxy Scanner' },
        { name: 'countryName', value: 'US' }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(caCert.subject.attributes);
    cert.setExtensions([{
        name: 'subjectAltName',
        altNames: [{
            type: 2, // DNS
            value: hostname
        }]
    }]);

    cert.sign(caKey, md.sha256.create());

    return {
        cert: pki.certificateToPem(cert),
        key: pki.privateKeyToPem(keys.privateKey)
    };
}

module.exports = {
    generateCA,
    generateHostCert
};
