<?php

namespace App\Http\Controllers\Api;

use Symfony\Component\HttpFoundation\Response;

class FormattedActiveLateClientsXlsxReportController extends ActiveLateClientsXlsxReportController
{
    public function download(): Response
    {
        $response = parent::download();
        $content = $response->getContent();

        if (! is_string($content) || $content === '') {
            return $response;
        }

        $files = $this->extractStoredZip($content);

        if (! isset($files['xl/styles.xml'], $files['xl/worksheets/sheet1.xml'])) {
            return $response;
        }

        $files['xl/styles.xml'] = $this->addCenteredNumberStyles($files['xl/styles.xml']);
        $files['xl/worksheets/sheet1.xml'] = $this->applyNumberStyles($files['xl/worksheets/sheet1.xml']);

        $xlsx = $this->buildStoredZip($files);
        $response->setContent($xlsx);
        $response->headers->set('Content-Length', (string) strlen($xlsx));

        return $response;
    }

    private function addCenteredNumberStyles(string $styles): string
    {
        if (! str_contains($styles, '<numFmts')) {
            $styles = preg_replace(
                '/(<styleSheet\b[^>]*>)/',
                '$1<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>',
                $styles,
                1,
            ) ?? $styles;
        }

        return preg_replace_callback(
            '/<cellXfs count="(\d+)">(.*?)<\/cellXfs>/s',
            function (array $matches): string {
                preg_match_all('/<xf\b.*?<\/xf>/s', $matches[2], $xfs);
                $original = $xfs[0] ?? [];

                if ($original === []) {
                    return $matches[0];
                }

                $numberStyles = array_map(function (string $xf): string {
                    $xf = preg_replace('/numFmtId="\d+"/', 'numFmtId="164"', $xf, 1) ?? $xf;
                    $xf = str_replace('horizontal="right"', 'horizontal="center"', $xf);

                    return $xf;
                }, $original);

                return '<cellXfs count="' . (count($original) * 2) . '">'
                    . $matches[2]
                    . implode('', $numberStyles)
                    . '</cellXfs>';
            },
            $styles,
            1,
        ) ?? $styles;
    }

    private function applyNumberStyles(string $sheet): string
    {
        return preg_replace_callback(
            '/<c r="([^"]+)" s="(\d+)"><v>/',
            fn (array $matches): string => '<c r="' . $matches[1] . '" s="' . ((int) $matches[2] + 7) . '"><v>',
            $sheet,
        ) ?? $sheet;
    }

    private function extractStoredZip(string $zip): array
    {
        $files = [];
        $offset = 0;
        $length = strlen($zip);

        while ($offset + 30 <= $length) {
            $header = unpack(
                'Vsignature/vversion/vflags/vcompression/vmtime/vmdate/Vcrc/Vcompressed/Vuncompressed/vnameLength/vextraLength',
                substr($zip, $offset, 30),
            );

            if (! is_array($header) || ($header['signature'] ?? 0) !== 0x04034b50) {
                break;
            }

            $nameLength = (int) $header['nameLength'];
            $extraLength = (int) $header['extraLength'];
            $compressedSize = (int) $header['compressed'];
            $compression = (int) $header['compression'];

            if ($compression !== 0) {
                return [];
            }

            $nameOffset = $offset + 30;
            $dataOffset = $nameOffset + $nameLength + $extraLength;
            $name = substr($zip, $nameOffset, $nameLength);
            $files[$name] = substr($zip, $dataOffset, $compressedSize);
            $offset = $dataOffset + $compressedSize;
        }

        return $files;
    }

    private function buildStoredZip(array $files): string
    {
        $body = '';
        $directory = '';
        $offset = 0;
        $count = 0;

        foreach ($files as $name => $content) {
            $name = (string) $name;
            $content = (string) $content;
            $nameLength = strlen($name);
            $size = strlen($content);
            $crc = (int) sprintf('%u', crc32($content));
            $flags = 0x0800;

            $local = pack(
                'VvvvvvVVVvv',
                0x04034b50,
                20,
                $flags,
                0,
                0,
                0,
                $crc,
                $size,
                $size,
                $nameLength,
                0,
            ) . $name . $content;

            $directory .= pack(
                'VvvvvvvVVVvvvvvVV',
                0x02014b50,
                20,
                20,
                $flags,
                0,
                0,
                0,
                $crc,
                $size,
                $size,
                $nameLength,
                0,
                0,
                0,
                0,
                0,
                $offset,
            ) . $name;

            $body .= $local;
            $offset += strlen($local);
            $count++;
        }

        $directoryOffset = strlen($body);
        $body .= $directory;
        $body .= pack(
            'VvvvvVVv',
            0x06054b50,
            0,
            0,
            $count,
            $count,
            strlen($directory),
            $directoryOffset,
            0,
        );

        return $body;
    }
}
